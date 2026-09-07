import { AttendanceAdmin } from "../../components/AttendanceAdmin";
import { committees } from "../../lib/committees";

export default function AttendanceAdminPage() {
  return <AttendanceAdmin committees={committees} />;
}
