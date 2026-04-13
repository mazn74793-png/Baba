export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(amount);
};

export const formatDate = (date: string) => {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};
