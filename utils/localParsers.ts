
import * as pdfjsLib from 'pdfjs-dist';
import Papa from 'papaparse';

// Configura o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

import { DetectedTransaction, DetectedMetadata } from '../types';

const MONTH_MAP: Record<string, string> = {
  'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
  'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12',
  'JANEIRO': '01', 'FEVEREIRO': '02', 'MARÇO': '03', 'ABRIL': '04', 'MAIO': '05', 'JUNHO': '06',
  'JULHO': '07', 'AGOSTO': '08', 'SETEMBRO': '09', 'OUTUBRO': '10', 'NOVEMBRO': '11', 'DEZEMBRO': '12'
};

// --- HELPER CATEGORIES ---
const categorize = (description: string): string => {
    const descUpper = description.toUpperCase();
    
    if (descUpper.includes('PAGAMENTO') && (descUpper.includes('FATURA') || descUpper.includes('CARTAO'))) return 'Pagamento de Cartão';
    
    if (descUpper.includes('IFOOD') || descUpper.includes('RESTAURANTE') || descUpper.includes('BURGER') || descUpper.includes('MCDONALDS') || descUpper.includes('SUBWAY')) return 'Alimentação';
    if (descUpper.includes('UBER') || descUpper.includes('99APP') || descUpper.includes('POSTO') || descUpper.includes('IPIRANGA') || descUpper.includes('SHELL')) return 'Transporte';
    if (descUpper.includes('NETFLIX') || descUpper.includes('SPOTIFY') || descUpper.includes('AMAZONPRIME') || descUpper.includes('APPLE.COM') || descUpper.includes('GOOGLE')) return 'Assinaturas';
    if (descUpper.includes('FARMACIA') || descUpper.includes('DROGARIA') || descUpper.includes('DROGASIL') || descUpper.includes('PAGUE MENOS')) return 'Saúde';
    if (descUpper.includes('MERCADO') || descUpper.includes('ATACADAO') || descUpper.includes('CARREFOUR') || descUpper.includes('ASSAI') || descUpper.includes('SUPERMERCADO') || descUpper.includes('EXTRA') || descUpper.includes('PAO DE ACUCAR')) return 'Mercado';
    if (descUpper.includes('SHOPEE') || descUpper.includes('MERCADOLIVRE') || descUpper.includes('MAGALU') || descUpper.includes('ALIEXPRESS') || descUpper.includes('SHEIN') || descUpper.includes('AMAZON')) return 'Compras';
    if (descUpper.includes('IOF') || descUpper.includes('TARIFA') || descUpper.includes('ANUIDADE')) return 'Impostos';
    
    return 'Outros';
};

// --- PDF PARSER ---
export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Adiciona quebras de linha para separar itens visualmente distantes
    let lastY = -1;
    const pageText = textContent.items.map((item: any) => {
        let str = item.str;
        if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
            str = '\n' + str;
        }
        lastY = item.transform[5];
        return str;
    }).join(' ');
    fullText += `\n${pageText}`;
  }

  return fullText;
};

// --- NUBANK PARSER (Regex & Logic) ---
export const parseNubankText = (text: string, filename?: string): { transactions: DetectedTransaction[], metadata: DetectedMetadata } => {
  const transactions: DetectedTransaction[] = [];
  const metadata: DetectedMetadata = { bankName: 'Nubank' };
  
  // 1. Tentar encontrar ano no nome do arquivo (ex: "Dezembro 2018.pdf")
  let filenameYear = new Date().getFullYear();
  if (filename) {
      const yearMatch = filename.match(/20\d{2}/);
      if (yearMatch) filenameYear = parseInt(yearMatch[0]);
  }

  // 2. Extrair Metadados do Texto
  // Limite
  const limitMatch = text.match(/Limite total.*?R\$\s*([\d\.,]+)/i);
  if (limitMatch) {
    metadata.limit = parseFloat(limitMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  // Vencimento
  const dueMatch = text.match(/vencimento:?\s*(\d{1,2})\s*([A-Z]{3})/i);
  if (dueMatch) {
    metadata.dueDay = parseInt(dueMatch[1]);
  }

  // Fechamento (estimado ou explícito)
  const closingMatch = text.match(/fechamento:?\s*(\d{1,2})\s*[A-Z]{3}/i);
  if (closingMatch) {
    metadata.closingDay = parseInt(closingMatch[1]);
  } else if (metadata.dueDay) {
    // Nubank geralmente fecha 7 dias antes
    metadata.closingDay = metadata.dueDay > 7 ? metadata.dueDay - 7 : 1; 
  }

  // Ano da Fatura (dentro do texto)
  const textYearMatch = text.match(/FATURA.*?(\d{4})/i) || text.match(/Vencimento.*?(\d{4})/i);
  let currentYear = textYearMatch ? parseInt(textYearMatch[1]) : filenameYear;

  // 3. Extrair Transações
  // Regex flexível para capturar: DD MMM Descrição R$ Valor
  // Ex: 05 OUT Uber *Trip R$ 14,90
  // Ex: 05 OUT Pagamento em ... -R$ 500,00
  const transactionRegex = /(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(.*?)\s+(?:-?R\$\s?)?(-?[\d\.,]+)/gi;
  
  const lines = text.split('\n');
  const buffer = lines.join('  '); // Junta tudo com espaço duplo para o regex pegar padrões multilinha se necessário

  let match;
  while ((match = transactionRegex.exec(buffer)) !== null) {
    const day = match[1];
    const monthStr = match[2];
    let description = match[3].trim();
    const amountStr = match[4];

    // Limpeza da descrição (remove lixo que o regex pode ter pego a mais)
    // Às vezes o regex pega "Uber *Trip R$ 20,00" e a descrição vira "Uber *Trip R$ 20,00"
    // Vamos cortar se encontrarmos o valor dentro da descrição
    const valIndex = description.indexOf('R$');
    if (valIndex > 0) description = description.substring(0, valIndex).trim();

    // FILTROS: Ignora linhas de cabeçalho/rodapé que parecem transações
    const lowerDesc = description.toLowerCase();
    if (
        lowerDesc.includes('total a pagar') ||
        lowerDesc.includes('limite total') ||
        lowerDesc.includes('saldo anterior') ||
        lowerDesc.includes('total de compras') ||
        lowerDesc.includes('pagamento de fatura') || // Isso é o pagamento que você faz, não uma despesa nova
        description.length < 3 || // Descrições muito curtas
        description.match(/^a \d{2} [A-Z]{3}/) // Lixo de quebra de linha
    ) continue;

    // Detectar Parcelas
    let installmentNumber: number | undefined;
    let totalInstallments: number | undefined;
    
    // Padrão 1: "Loja 01/10"
    const instMatch1 = description.match(/(\d{1,2})\/(\d{1,2})/);
    if (instMatch1) {
        installmentNumber = parseInt(instMatch1[1]);
        totalInstallments = parseInt(instMatch1[2]);
    } else {
        // Padrão 2: "Parcela 2 de 10"
        const instMatch2 = description.match(/Parcela (\d{1,2}) de (\d{1,2})/i);
        if (instMatch2) {
            installmentNumber = parseInt(instMatch2[1]);
            totalInstallments = parseInt(instMatch2[2]);
        }
    }

    // Processar Valor
    let amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
    let type: 'income' | 'expense' = 'expense';

    // No Nubank PDF, despesas são positivas na lista de compras.
    // Pagamentos recebidos (créditos na fatura) geralmente têm um sinal de menos OU são identificados pelo texto.
    // Estorno, Cancelamento, Depósito
    if (
        lowerDesc.includes('estorno') || 
        lowerDesc.includes('cancelamento') || 
        lowerDesc.includes('crédito de') || 
        lowerDesc.includes('reembolso') ||
        amount < 0 // Se o regex pegou negativo
    ) {
        type = 'income';
        amount = Math.abs(amount);
    } else {
        // Pagamento de Fatura (entrada de dinheiro para pagar a conta)
        if (lowerDesc.includes('pagamento em') || lowerDesc.includes('pagamento recebido')) {
             // Ignora pagamento da própria fatura para não duplicar saldo se o usuário gerencia conta corrente separado
             continue; 
        }
    }

    // Processar Data
    const month = MONTH_MAP[monthStr];
    let year = currentYear;
    
    // Lógica de virada de ano
    // Se a fatura é de Janeiro (metadata.dueDay em JAN), mas a compra foi em DEZ, o ano da compra é anterior.
    // Assumimos que 'currentYear' é o ano da FATURA.
    const invoiceMonth = filename ? filename.toUpperCase() : '';
    if (invoiceMonth.includes('JANEIRO') && monthStr === 'DEZ') {
        year = currentYear - 1;
    } else if (filename && filenameYear && currentYear !== filenameYear) {
        // Se extraímos o ano do arquivo com segurança, usamos ele preferencialmente
        year = filenameYear;
        // Ajuste reverso: Fatura Dezembro 2018, compra em JAN (impossível, mas ok)
    }

    const date = `${year}-${month}-${day}`;
    const category = categorize(description);

    transactions.push({
      date,
      description,
      amount,
      type,
      category,
      selected: true,
      sourceType: 'card',
      bankName: 'Nubank',
      installmentNumber,
      totalInstallments
    });
  }
  
  // Remove duplicatas exatas extraídas do mesmo arquivo (bug comum de regex pegando cabeçalhos repetidos)
  const uniqueTransactions = transactions.filter((t, index, self) =>
    index === self.findIndex((u) => (
      u.date === t.date && u.description === t.description && u.amount === t.amount
    ))
  );

  return { transactions: uniqueTransactions, metadata };
};

// --- CSV PARSER ---
export const parseCSV = (csvText: string): { transactions: DetectedTransaction[], metadata: DetectedMetadata } => {
    const transactions: DetectedTransaction[] = [];
    const metadata: DetectedMetadata = { bankName: 'Importado (CSV)' };

    const result = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true 
    });

    if (result.errors.length > 0) {
        console.warn("CSV Errors:", result.errors);
    }

    // Normaliza headers para lowercase e remove acentos/espaços
    const data = result.data.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            newRow[normalizedKey] = row[key];
        });
        return newRow;
    });

    data.forEach((row: any) => {
        // Tenta mapear colunas comuns
        const dateRaw = row['date'] || row['data'] || row['dt'] || row['posted date'] || row['dia'];
        const descRaw = row['title'] || row['description'] || row['descrição'] || row['descricao'] || row['estabelecimento'] || row['historico'] || row['memo'];
        const amountRaw = row['amount'] || row['valor'] || row['value'] || row['quantia'];
        const categoryRaw = row['category'] || row['categoria'];

        if (!dateRaw || amountRaw === undefined) return;

        // Processa Data (Assume ISO YYYY-MM-DD ou DD/MM/YYYY)
        let date = '';
        const dateStr = String(dateRaw).trim();
        
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                if (parts[2].length === 4) { // DD/MM/YYYY ou MM/DD/YYYY
                    // Assumindo DD/MM/YYYY para BR
                    date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                }
            }
        } else if (dateStr.includes('-')) {
            date = dateStr; // Provavelmente ISO
        }

        if (!date || date.length < 10) return; // Data inválida

        // Processa Valor
        let amount = 0;
        let type: 'income' | 'expense' = 'expense';

        if (typeof amountRaw === 'number') {
            amount = Math.abs(amountRaw);
            if (amountRaw < 0) type = 'expense';
            else if (amountRaw > 0) {
                // Em CSV de cartão, positivo costuma ser compra (expense), negativo estorno (income)
                // Em CSV de conta, positivo é entrada (income), negativo saída (expense)
                // Heurística: Se descrição parecer pagamento/compra, é expense.
                type = 'expense'; // Default assumindo cartão ou saída positiva
            }
        } else if (typeof amountRaw === 'string') {
            let valStr = amountRaw.replace(/[R$\s]/g, '').trim();
            if (valStr.includes(',') && valStr.includes('.')) {
                 valStr = valStr.replace(/\./g, '').replace(',', '.');
            } else if (valStr.includes(',')) {
                 valStr = valStr.replace(',', '.');
            }
            const val = parseFloat(valStr);
            amount = Math.abs(val);
            if (val < 0) type = 'expense'; // Muitos CSVs usam negativo para gasto
            else type = 'expense';
        }

        // Processa Descrição
        let description = descRaw ? String(descRaw).trim() : 'Sem descrição';
        
        // Detecta Income por descrição se for ambíguo
        const lowerDesc = description.toLowerCase();
        if (lowerDesc.includes('depósito') || lowerDesc.includes('recebido') || lowerDesc.includes('pix recebido') || lowerDesc.includes('salário') || lowerDesc.includes('estorno')) {
            type = 'income';
        }

        // Parcelas
        let installmentNumber: number | undefined;
        let totalInstallments: number | undefined;
        const instMatch = description.match(/(\d{1,2})[\/](\d{1,2})/);
        if (instMatch) {
            installmentNumber = parseInt(instMatch[1]);
            totalInstallments = parseInt(instMatch[2]);
        }

        const category = categoryRaw ? String(categoryRaw) : categorize(description);

        transactions.push({
            date,
            description,
            amount,
            type,
            category,
            selected: true,
            sourceType: 'card', 
            bankName: metadata.bankName,
            installmentNumber,
            totalInstallments
        });
    });

    return { transactions, metadata };
};
