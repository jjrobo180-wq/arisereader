export type Seat = 1 | 2;
export type BoardProps<V = any> = {
  view: V;
  seat: Seat;
  /** True when it is my turn, the match is live and no move is being sent. */
  canAct: boolean;
  act: (move: unknown) => void;
  finished: boolean;
  myName: string;
  theirName: string;
};
export const other = (seat: Seat): Seat => (seat === 1 ? 2 : 1);
