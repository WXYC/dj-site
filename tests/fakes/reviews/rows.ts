/** A list given as rows, or as a function so a spec can change the answer over time. */
export type Rows<Row> = Row[] | (() => Row[]);
export const resolve = <Row>(rows: Rows<Row>) => (typeof rows === "function" ? rows() : rows);
