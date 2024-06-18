export const onlyUnique = (array: any[], key: string) => {
  const uniqueItems = array.filter(
    (item, index, self) => index === self.findIndex((t) => t[key] === item[key])
  );
  return uniqueItems;
};
