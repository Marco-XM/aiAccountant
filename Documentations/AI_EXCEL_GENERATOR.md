# AI Excel Generator - Feature Documentation

## Overview
The AI Excel Generator uses Google's Gemini AI to create custom Excel spreadsheets based on natural language prompts. Users can describe their desired Excel structure, and the AI will generate a formatted Excel file with colors, formulas, borders, and specific cell configurations.

## Features

### 1. Natural Language Prompts
Users can describe Excel sheets in plain English:
- "Create an excel sheet with 10 green rows where I can enter values"
- "Make a budget tracker with 5 columns and formulas"
- "Generate a grade sheet with average calculations"

### 2. Supported Excel Features
- **Cell Colors**: Yellow, Green, Red, Blue, Orange, Gray, and custom colors
- **Formulas**: SUM, AVERAGE, and other Excel formulas
- **Borders**: Thin, medium, thick, dotted, dashed
- **Font Styling**: Bold, italic, colors, sizes
- **Cell Alignment**: Center, left, right, top, bottom, middle
- **Column Widths**: Custom widths for each column
- **Row Heights**: Custom heights for each row
- **Merged Cells**: Combine multiple cells

### 3. Technical Stack

#### Backend
- **API**: `/api/ai-excel/generate` (POST)
- **Controller**: `aiExcelController.js`
- **Library**: ExcelJS for Excel generation
- **AI Model**: Google Gemini 2.0 Flash Exp
- **Authentication**: JWT token required

#### Frontend
- **Component**: `AIExcelGenerator.jsx`
- **Route**: `/ai-excel`
- **Features**: 
  - Prompt input with examples
  - Loading states
  - File download
  - Example prompts
  - Tips section

## API Endpoints

### Generate Excel
```
POST /api/ai-excel/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Your Excel description here"
}

Response:
{
  "success": true,
  "message": "Excel file generated successfully",
  "fileName": "excel_1234567890.xlsx",
  "downloadUrl": "/api/ai-excel/download/excel_1234567890.xlsx",
  "config": { /* AI-generated Excel configuration */ }
}
```

### Download Excel
```
GET /api/ai-excel/download/:fileName
Authorization: Bearer <token>

Response: Excel file download
```

## Example Prompts

1. **Simple Data Entry**
   - "Create an excel sheet with 10 green rows where I can enter values, then save the sum in the first row second column with yellow background"

2. **Budget Tracker**
   - "Make a budget tracker with 5 columns: Date, Category, Amount, Notes, and Balance. Add formulas to calculate running balance"

3. **Grade Sheet**
   - "Create a grade sheet with student names in column A, 3 test scores in columns B-D, and average in column E"

4. **Expense Tracker**
   - "Generate a monthly expense tracker with categories in rows and months in columns, include total row at bottom"

5. **Inventory Sheet**
   - "Create an inventory sheet with item name, quantity, unit price, and total value columns. Make headers blue with white text"

## Color Codes (ARGB Format)
- Yellow: `FFFFFF00`
- Green: `FF00FF00`
- Light Green: `FF90EE90`
- Red: `FFFF0000`
- Blue: `FF0000FF`
- Light Blue: `FFADD8E6`
- Orange: `FFFFA500`
- Gray: `FFD3D3D3`
- White: `FFFFFFFF`
- Black text: `FF000000`

## File Management
- Generated files are stored in `backend/uploads/`
- Files are automatically deleted 5 seconds after download
- Unique filenames using timestamps

## Security
- Authentication required for all endpoints
- JWT token validation
- File access restricted to authenticated users

## Error Handling
- Invalid prompts return error messages
- AI parsing failures are caught and logged
- File not found errors handled gracefully

## Usage Tips
1. Be specific about colors (green, yellow, blue, etc.)
2. Mention exact number of rows and columns
3. Request formulas using Excel syntax (SUM, AVERAGE, etc.)
4. Define cell positions clearly (first row, second column)
5. Ask for headers, borders, and formatting explicitly
6. Specify data types and structure needed

## Future Enhancements
- [ ] Preview generated Excel before download
- [ ] Save and reuse prompts
- [ ] Template library
- [ ] More complex formulas (VLOOKUP, IF, etc.)
- [ ] Conditional formatting
- [ ] Charts and graphs
- [ ] Multiple sheets support
