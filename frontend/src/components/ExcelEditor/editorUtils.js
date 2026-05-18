export const columnToLabel = (index) => {
  let label = '';
  let current = index + 1;

  while (current > 0) {
    label = String.fromCharCode(((current - 1) % 26) + 65) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
};

export const getCellDisplayValue = (cell) => {
  if (!cell) return '';
  if (cell.formula) return cell.value ?? cell.formula ?? '';
  return cell.value ?? '';
};

export const getCellTitle = (cell) => {
  if (!cell?.formula) return '';
  return `Formula: ${cell.formula}`;
};