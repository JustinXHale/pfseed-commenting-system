export interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

export interface Thread {
  id: string;
  xPercent: number; // Percentage from left (0-100)
  yPercent: number; // Percentage from top (0-100)
  route: string;
  comments: Comment[];
}
