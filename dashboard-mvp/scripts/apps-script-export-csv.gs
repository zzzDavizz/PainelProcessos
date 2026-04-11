/**
 * Att_PainelProcessos — exporta abas da planilha para CSV no Google Drive.
 * Cole o conteúdo em Apps Script (Extensões → Apps Script) vinculado à planilha.
 *
 * 1) Ajuste CONFIG.abas e CONFIG.prefixoArquivo se precisar.
 * 2) Execute uma vez: exportarAbasParaCsvNoDrive (autorize permissões).
 * 3) AUTOMÁTICO (mesmo ficheiro a cada edição): execute UMA vez criarGatilhoAoEditar()
 *    no editor (função + Executar). O mesmo ficheiro no Drive é sobrescrito via ID guardado.
 * 4) Partilhe o CSV como “Qualquer pessoa com o link – leitor” e use a URL em PAINEL_CSV_URL no Next.
 */

var CONFIG = {
  /**
   * Nomes exatos das abas (barra inferior). "PILARES" e "PSI" são blocos *dentro*
   * da aba RESUMO — não são nomes de aba. Ajuste aqui se renomear abas na planilha.
   */
  abas: ["RESUMO", "FLUXO DOS PROCESSOS"],
  /** Separador: ";" costuma abrir certo no Excel BR; use "," se o BI exigir. */
  delimitador: ";",
  /** Prefixo opcional nos nomes dos ficheiros (ex.: Painel_). */
  prefixoArquivo: "Painel_",
  /** Chave no PropertiesService para guardar o mapa aba → id do ficheiro no Drive. */
  propKeyIds: "CSV_DRIVE_FILE_IDS_JSON",
};

/**
 * Formata valor para texto no CSV (getValues: datas como Date, números sem "R$").
 */
function formatarCelula_(valor) {
  if (valor === null || valor === undefined) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  if (typeof valor === "number") {
    return String(valor);
  }
  return String(valor);
}

/**
 * Escapa campo para CSV (RFC 4180).
 */
function escaparCampo_(texto, delim) {
  var s = formatarCelula_(texto);
  var precisaAspas = /[\r\n"]/.test(s) || s.indexOf(delim) !== -1;
  var t = s.replace(/"/g, '""');
  return precisaAspas ? '"' + t + '"' : t;
}

/**
 * Converte matriz 2D em string CSV.
 */
function matrizParaCsv_(linhas, delim) {
  return linhas
    .map(function (linha) {
      return linha
        .map(function (celula) {
          return escaparCampo_(celula, delim);
        })
        .join(delim);
    })
    .join("\n");
}

/**
 * Nome seguro do ficheiro (sem caracteres problemáticos no Drive).
 */
function nomeArquivoCsv_(nomeAba) {
  var base = nomeAba.replace(/[^\w\u00C0-\u024f\s-]/gi, "").replace(/\s+/g, "_");
  return CONFIG.prefixoArquivo + base + ".csv";
}

/**
 * Lê mapa aba → fileId guardado; devolve objeto ou {}.
 */
function lerMapaIds_() {
  var raw = PropertiesService.getScriptProperties().getProperty(CONFIG.propKeyIds);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

/**
 * Grava mapa aba → fileId.
 */
function gravarMapaIds_(mapa) {
  PropertiesService.getScriptProperties().setProperty(CONFIG.propKeyIds, JSON.stringify(mapa));
}

/**
 * Cria ou atualiza um ficheiro CSV no Drive com o conteúdo dado.
 * @param {string} nomeArquivo - ex.: Painel_PILARES.csv
 * @param {string} conteudoCsv - corpo UTF-8
 * @param {string} chaveAba - chave única para reutilizar o mesmo ficheiro
 */
function salvarOuAtualizarCsvNoDrive_(nomeArquivo, conteudoCsv, chaveAba) {
  var mapa = lerMapaIds_();
  var fileId = mapa[chaveAba];
  var mime = MimeType.CSV;
  var blob = Utilities.newBlob(conteudoCsv, mime, nomeArquivo);

  if (fileId) {
    try {
      var f = DriveApp.getFileById(fileId);
      f.setContent(conteudoCsv);
      f.setName(nomeArquivo);
      return fileId;
    } catch (err) {
      delete mapa[chaveAba];
      gravarMapaIds_(mapa);
    }
  }

  var criado = DriveApp.createFile(blob);
  mapa[chaveAba] = criado.getId();
  gravarMapaIds_(mapa);
  return criado.getId();
}

/**
 * Exporta todas as abas listadas em CONFIG para CSV no Drive.
 * Execute esta função no editor (Executar) depois de autorizar.
 */
function exportarAbasParaCsvNoDrive() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var delim = CONFIG.delimitador;
  var resumo = [];

  CONFIG.abas.forEach(function (nomeAba) {
    var aba = ss.getSheetByName(nomeAba);
    if (!aba) {
      resumo.push("Aba não encontrada: " + nomeAba);
      return;
    }
    var dados = aba.getDataRange().getValues();
    var csv = matrizParaCsv_(dados, delim);
    var nomeFicheiro = nomeArquivoCsv_(nomeAba);
    var id = salvarOuAtualizarCsvNoDrive_(nomeFicheiro, csv, nomeAba);
    resumo.push(nomeAba + " → " + nomeFicheiro + " (id: " + id + ")");
  });

  Logger.log(resumo.join("\n"));
  return resumo.join("\n");
}

/**
 * Gatilho instalável: chame UMA vez no editor (Executar) para criar o disparo "Ao editar".
 * Depois, qualquer edição na planilha atualiza os CSVs (pode ser pesado em planilhas muito grandes).
 */
function criarGatilhoAoEditar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === "exportarAbasParaCsvNoDrive") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("exportarAbasParaCsvNoDrive").forSpreadsheet(ss).onEdit().create();
}

/**
 * Opcional: remove o gatilho "Ao editar" deste export.
 */
function removerGatilhoAoEditar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "exportarAbasParaCsvNoDrive") {
      ScriptApp.deleteTrigger(t);
    }
  });
}
