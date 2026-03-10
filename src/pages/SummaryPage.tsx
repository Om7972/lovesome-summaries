import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// SummaryPage redirects to Dashboard where summary creation lives
export default function SummaryPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/dashboard", { replace: true }); }, [navigate]);
  return null;
}
