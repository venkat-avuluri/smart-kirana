/**
 * Robust RFC-4180 compliant CSV parser and template generator
 */

/**
 * Parse CSV string to array of row objects
 * @param {string} csvText 
 * @returns {Array<Object>} parsed rows with header keys
 */
export const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return [];

  // Normalize line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);

  if (nonEmptyLines.length === 0) return [];

  // Parse a single line into columns taking quotes into account
  const parseLine = (line) => {
    const row = [];
    let insideQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          entry += '"';
          i++;
        } else {
          // Toggle quote
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  };

  const headers = parseLine(nonEmptyLines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows = [];

  for (let i = 1; i < nonEmptyLines.length; i++) {
    const values = parseLine(nonEmptyLines[i]);
    const rowObj = { _rowNumber: i + 1 };

    headers.forEach((header, index) => {
      rowObj[header] = values[index] !== undefined ? values[index] : '';
    });

    rows.push(rowObj);
  }

  return rows;
};

/**
 * Generate standard CSV template for product catalog import
 */
export const getProductCSVTemplate = () => {
  const headers = [
    'Name',
    'Category',
    'Unit',
    'PurchasePriceRupees',
    'SellingPriceRupees',
    'MRPRupees',
    'CurrentStock',
    'MinStockLevel',
    'Barcodes',
    'Description',
  ];

  const examples = [
    [
      '"Sona Masoori Rice"',
      '"Grains & Staples"',
      'kg',
      '52.00',
      '58.00',
      '60.00',
      '50.000',
      '10',
      '"8901234567890"',
      '"Loose polished raw rice"',
    ],
    [
      '"Fortune Sunflower Oil Pouch"',
      '"Oils & Ghee"',
      'L',
      '118.00',
      '135.00',
      '145.00',
      '24.000',
      '5',
      '"8909876543210,8909876543211"',
      '"1 Litre refined sunflower pouch"',
    ],
    [
      '"Sugar Loose (Madhur)"',
      '"Grains & Staples"',
      'kg',
      '38.50',
      '42.00',
      '45.00',
      '100.000',
      '20',
      '""',
      '"Loose white sulphur-free sugar"',
    ],
    [
      '"Maggi 2-Minute Masala Noodles"',
      '"Packaged Snacks"',
      'packet',
      '12.00',
      '14.00',
      '14.00',
      '72',
      '12',
      '"8901058852331"',
      '"70g classic masala packet"',
    ],
  ];

  const content = [headers.join(','), ...examples.map((e) => e.join(','))].join('\r\n');
  return content;
};
