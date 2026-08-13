import { CommitteePicker } from "./components/CommitteePicker";
import { committees } from "./lib/committees";

export default function Home() {
  return <CommitteePicker committees={committees} />;
}
