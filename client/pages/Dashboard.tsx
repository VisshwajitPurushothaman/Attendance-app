import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import AdminDashboard from "./AdminDashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("userRole");

  useEffect(() => {
    // If no role is set, redirect to role selection
    if (!role) {
      navigate("/role-selection");
    }
  }, [role, navigate]);

  // Render appropriate dashboard based on role
  if (role === "student") {
    return <StudentDashboard />;
  } else if (role === "teacher") {
    return <TeacherDashboard />;
  } else if (role === "admin") {
    return <AdminDashboard />;
  }

  // Fallback if role is not recognized
  return null;
}
