export const formatCurrency = (amount: number) => {
  return amount.toLocaleString('ar-EG') + ' ج.م';
};

export const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};
