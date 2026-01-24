interface characterType {
  id: string;
  name: string;
  description: string;
  stories: {
    id: string;
    title: string;
    content: string;
  }[];
}
export type { characterType };
