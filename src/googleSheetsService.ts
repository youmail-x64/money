export interface Pocket {
  id: string;
  name: string;
  saldoAwal: number;
  balance: number;
}

export interface Transaction {
  timestamp: string;
  date: string;
  type: 'Masuk' | 'Keluar';
  category: string;
  amount: number;
  description: string;
  pocketId: string;
}

// Fetch list of spreadsheets from Google Drive
export async function listSpreadsheets(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const url = `https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27+and+trashed%3Dfalse&fields=files(id%2Cname)&orderBy=name`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
    throw new Error('Gagal mengambil daftar spreadsheet dari Google Drive.');
  }
  
  const data = await response.json();
  return data.files || [];
}

// Create a new spreadsheet
export async function createSpreadsheet(accessToken: string, name: string): Promise<string> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: name,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Gagal membuat spreadsheet baru.');
  }

  const data = await response.json();
  return data.spreadsheetId;
}

// Helper to get all sheet names and their numerical sheet IDs
export async function getSheetIds(accessToken: string, spreadsheetId: string): Promise<Record<string, number>> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Gagal mengambil metadata spreadsheet.');
  }

  const data = await response.json();
  const result: Record<string, number> = {};
  for (const sheet of data.sheets || []) {
    result[sheet.properties.title] = sheet.properties.sheetId;
  }
  return result;
}

// Helper to delete a row by index (1-based index)
export async function deleteRow(
  accessToken: string,
  spreadsheetId: string,
  sheetName: 'Transaksi' | 'Kantong',
  rowIndex: number
): Promise<void> {
  const sheetIds = await getSheetIds(accessToken, spreadsheetId);
  const sheetId = sheetIds[sheetName];
  if (sheetId === undefined) {
    throw new Error(`Lembar kerja ${sheetName} tidak ditemukan.`);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1, // 0-based, inclusive
              endIndex: rowIndex,       // 0-based, exclusive
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gagal menghapus baris di lembar kerja ${sheetName}.`);
  }
}

// Initialize system (creates Transaksi and Kantong sheets if they do not exist)
export async function setupSystem(accessToken: string, spreadsheetId: string): Promise<void> {
  // 1. Fetch current sheets
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Gagal mengambil metadata spreadsheet.');
  }

  const data = await response.json();
  const sheets: any[] = data.sheets || [];
  const sheetNames = sheets.map((s) => s.properties.title);

  const sheetsToCreate: string[] = [];
  if (!sheetNames.includes('Transaksi')) sheetsToCreate.push('Transaksi');
  if (!sheetNames.includes('Kantong')) sheetsToCreate.push('Kantong');

  // 2. Create missing sheets
  if (sheetsToCreate.length > 0) {
    const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const batchResponse = await fetch(batchUpdateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: sheetsToCreate.map((title) => ({
          addSheet: {
            properties: { title },
          },
        })),
      }),
    });

    if (!batchResponse.ok) {
      throw new Error('Gagal membuat lembar kerja Transaksi atau Kantong.');
    }
  }

  // 3. Initialize headers for Transaksi
  const headerTransaksi = [
    ['Timestamp', 'Tanggal', 'Tipe', 'Kategori', 'Nominal', 'Deskripsi', 'ID_Kantong'],
  ];
  await writeSheetValues(accessToken, spreadsheetId, 'Transaksi!A1:G1', headerTransaksi);

  // 4. Check if Kantong is already initialized, otherwise create headers and default pockets
  const kantongData = await readSheetValues(accessToken, spreadsheetId, 'Kantong!A1:D5');
  if (!kantongData || kantongData.length === 0 || !kantongData[0] || kantongData[0].length === 0) {
    // Write headers with Saldo_Awal instead of Target
    const headerKantong = [['ID_Kantong', 'Nama_Kantong', 'Saldo_Awal', 'Saldo_Saat_Ini']];
    await writeSheetValues(accessToken, spreadsheetId, 'Kantong!A1:D1', headerKantong);

    // Seed default pockets with auto formulas for Saldo_Saat_Ini
    // Formula: =C2+SUMIF(Transaksi!G:G, A2, Transaksi!E:E)
    // Formula: =C3+SUMIF(Transaksi!G:G, A3, Transaksi!E:E) etc.
    const defaultPockets = [
      ['K01', 'Makan & Minum', 1000000, '=C2+SUMIF(Transaksi!G:G, A2, Transaksi!E:E)'],
      ['K02', 'Transportasi', 300000, '=C3+SUMIF(Transaksi!G:G, A3, Transaksi!E:E)'],
      ['K03', 'Tagihan & Bulanan', 2000000, '=C4+SUMIF(Transaksi!G:G, A4, Transaksi!E:E)'],
      ['K04', 'Tabungan & Investasi', 1000000, '=C5+SUMIF(Transaksi!G:G, A5, Transaksi!E:E)'],
      ['K05', 'Hiburan & Hobi', 500000, '=C6+SUMIF(Transaksi!G:G, A6, Transaksi!E:E)'],
    ];
    await writeSheetValues(accessToken, spreadsheetId, 'Kantong!A2:D6', defaultPockets);
  } else {
    // Update headers to Saldo_Awal instead of Target
    const headerKantong = [['ID_Kantong', 'Nama_Kantong', 'Saldo_Awal', 'Saldo_Saat_Ini']];
    await writeSheetValues(accessToken, spreadsheetId, 'Kantong!A1:D1', headerKantong);

    // Let's check if the existing pocket formulas use C2 instead of SUMIF alone
    const allPockets = await readSheetValues(accessToken, spreadsheetId, 'Kantong!A2:D100');
    if (allPockets && allPockets.length > 0) {
      let needsFormulaUpdate = false;
      const updatedRows = allPockets.map((row, i) => {
        const rowNum = i + 2;
        const id = row[0] || '';
        const name = row[1] || '';
        const saldoAwal = parseFloat(row[2]) || 0;
        const currentFormulaOrValue = row[3] || '';
        
        // If the formula does not start with =C or doesn't have +SUMIF, we update it
        if (!currentFormulaOrValue.startsWith(`=C${rowNum}`)) {
          needsFormulaUpdate = true;
        }

        const formula = `=C${rowNum}+SUMIF(Transaksi!G:G, A${rowNum}, Transaksi!E:E)`;
        return [id, name, saldoAwal, formula];
      });

      if (needsFormulaUpdate) {
        await writeSheetValues(accessToken, spreadsheetId, `Kantong!A2:D${updatedRows.length + 1}`, updatedRows);
      }
    }
  }
}

// Read values from a sheet range
export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<any[][] | null> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.values || [];
}

// Write values to a range
export async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gagal menulis data ke range ${range}.`);
  }
}

// Append values to a sheet (like Transaksi)
export async function appendSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gagal menambahkan data ke range ${range}.`);
  }
}

// Fetch all Kantong
export async function fetchPockets(accessToken: string, spreadsheetId: string): Promise<Pocket[]> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Kantong!A2:D100');
  if (!values) return [];

  return values.map((row) => {
    const id = row[0] || '';
    const name = row[1] || '';
    const saldoAwal = parseFloat(row[2]) || 0;
    const balance = parseFloat(row[3]) || 0;
    return { id, name, saldoAwal, balance };
  }).filter(p => p.id !== '');
}

// Add a new Pocket
export async function addPocket(
  accessToken: string,
  spreadsheetId: string,
  id: string,
  name: string,
  saldoAwal: number,
  rowCount: number
): Promise<void> {
  const range = `Kantong!A${rowCount}:D${rowCount}`;
  const formula = `=C${rowCount}+SUMIF(Transaksi!G:G, A${rowCount}, Transaksi!E:E)`;
  const values = [[id, name, saldoAwal, formula]];
  await writeSheetValues(accessToken, spreadsheetId, range, values);
}

// Update pocket by matching pocketId
export async function updatePocket(
  accessToken: string,
  spreadsheetId: string,
  originalId: string,
  updatedData: {
    id: string;
    name: string;
    saldoAwal: number;
  }
): Promise<void> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Kantong!A2:D100');
  if (!values) throw new Error('Data kantong tidak ditemukan.');

  const matchIndex = values.findIndex(row => row[0] === originalId);
  if (matchIndex === -1) {
    throw new Error('Kantong yang akan diubah tidak ditemukan di Google Sheets.');
  }

  const rowIndex = matchIndex + 2;
  const formula = `=C${rowIndex}+SUMIF(Transaksi!G:G, A${rowIndex}, Transaksi!E:E)`;
  const row = [
    updatedData.id,
    updatedData.name,
    updatedData.saldoAwal,
    formula
  ];

  await writeSheetValues(accessToken, spreadsheetId, `Kantong!A${rowIndex}:D${rowIndex}`, [row]);
  
  // If the Pocket ID changed, we must also update any transactions referencing the old pocket ID!
  if (originalId !== updatedData.id) {
    const txValues = await readSheetValues(accessToken, spreadsheetId, 'Transaksi!A2:G5000');
    if (txValues && txValues.length > 0) {
      for (let i = 0; i < txValues.length; i++) {
        if (txValues[i][6] === originalId) {
          const txRowIndex = i + 2;
          await writeSheetValues(accessToken, spreadsheetId, `Transaksi!G${txRowIndex}`, [[updatedData.id]]);
        }
      }
    }
  }
}

// Delete pocket by matching pocketId
export async function deletePocketById(
  accessToken: string,
  spreadsheetId: string,
  pocketId: string
): Promise<void> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Kantong!A2:D100');
  if (!values) throw new Error('Data kantong tidak ditemukan.');

  const matchIndex = values.findIndex(row => row[0] === pocketId);
  if (matchIndex === -1) {
    throw new Error('Kantong yang akan dihapus tidak ditemukan di Google Sheets.');
  }

  const rowIndex = matchIndex + 2;
  await deleteRow(accessToken, spreadsheetId, 'Kantong', rowIndex);

  // Clean up references in transactions (set them to empty string)
  const txValues = await readSheetValues(accessToken, spreadsheetId, 'Transaksi!A2:G5000');
  if (txValues && txValues.length > 0) {
    for (let i = 0; i < txValues.length; i++) {
      if (txValues[i][6] === pocketId) {
        const txRowIndex = i + 2;
        await writeSheetValues(accessToken, spreadsheetId, `Transaksi!G${txRowIndex}`, [['']]);
      }
    }
  }
}

// Fetch all Transaksi
export async function fetchTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Transaksi!A2:G5000');
  if (!values) return [];

  return values.map((row) => {
    return {
      timestamp: row[0] || '',
      date: row[1] || '',
      type: (row[2] as 'Masuk' | 'Keluar') || 'Keluar',
      category: row[3] || '',
      amount: parseFloat(row[4]) || 0,
      description: row[5] || '',
      pocketId: row[6] || '',
    };
  }).filter(t => t.timestamp !== '');
}

// Save transaction
export async function saveTransaction(
  accessToken: string,
  spreadsheetId: string,
  formData: {
    date: string;
    type: 'Masuk' | 'Keluar';
    category: string;
    amount: number;
    description: string;
    pocketId: string;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Ensure that 'Keluar' is saved as a negative number, 'Masuk' as positive
  const nominalValue = formData.type === 'Keluar' ? -Math.abs(formData.amount) : Math.abs(formData.amount);
  
  const row = [
    timestamp,
    formData.date,
    formData.type,
    formData.category,
    nominalValue,
    formData.description,
    formData.pocketId,
  ];

  await appendSheetValues(accessToken, spreadsheetId, 'Transaksi!A:G', [row]);
}

// Update transaction by matching timestamp
export async function updateTransaction(
  accessToken: string,
  spreadsheetId: string,
  originalTimestamp: string,
  updatedData: {
    date: string;
    type: 'Masuk' | 'Keluar';
    category: string;
    amount: number;
    description: string;
    pocketId: string;
  }
): Promise<void> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Transaksi!A2:G5000');
  if (!values) throw new Error('Data transaksi tidak ditemukan.');

  const matchIndex = values.findIndex(row => row[0] === originalTimestamp);
  if (matchIndex === -1) {
    throw new Error('Transaksi yang akan diubah tidak ditemukan di Google Sheets.');
  }

  const rowIndex = matchIndex + 2;
  const nominalValue = updatedData.type === 'Keluar' ? -Math.abs(updatedData.amount) : Math.abs(updatedData.amount);

  const row = [
    originalTimestamp,
    updatedData.date,
    updatedData.type,
    updatedData.category,
    nominalValue,
    updatedData.description,
    updatedData.pocketId,
  ];

  await writeSheetValues(accessToken, spreadsheetId, `Transaksi!A${rowIndex}:G${rowIndex}`, [row]);
}

// Delete transaction by matching timestamp
export async function deleteTransactionByTimestamp(
  accessToken: string,
  spreadsheetId: string,
  timestamp: string
): Promise<void> {
  const values = await readSheetValues(accessToken, spreadsheetId, 'Transaksi!A2:G5000');
  if (!values) throw new Error('Data transaksi tidak ditemukan.');

  const matchIndex = values.findIndex(row => row[0] === timestamp);
  if (matchIndex === -1) {
    throw new Error('Transaksi yang akan dihapus tidak ditemukan di Google Sheets.');
  }

  const rowIndex = matchIndex + 2;
  await deleteRow(accessToken, spreadsheetId, 'Transaksi', rowIndex);
}
