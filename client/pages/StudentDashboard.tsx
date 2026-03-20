import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  QrCode,
  User,
  LogOut,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const [daysPresent, setDaysPresent] = useState(0);
  const [daysAbsent, setDaysAbsent] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserName(user.name);
      setProfilePhoto(user.profilePhoto || null);

      // Fetch stats
      fetch(`/api/attendance/stats/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setDaysPresent(data.present);
          setDaysAbsent(data.absent);
          setAttendancePercentage(data.percentage);
        })
        .catch(err => console.error("Failed to fetch stats", err));

    } else {
      setUserName("Student");
    }
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">AttendanceApp</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => navigate("/profile")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gray-200 active:scale-95 transition-transform"
              aria-label="Profile"
            >
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="p-2 active:bg-gray-100 hover:bg-gray-100 rounded-lg transition touch-none"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Welcome, {userName}! 👋
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Here's your attendance overview for this semester
          </p>
        </div>

        {/* Primary CTA - Mark Attendance */}
        <div className="mb-8 sm:mb-12">
          <button
            onClick={() => navigate("/attendance")}
            className="w-full bg-gradient-to-r from-blue-600 to-teal-600 active:from-blue-700 active:to-teal-700 hover:from-blue-700 hover:to-teal-700 text-white rounded-xl p-4 sm:p-8 flex flex-col sm:flex-row items-center justify-between transition-all hover:shadow-lg gap-4 sm:gap-0 min-h-[120px] sm:min-h-auto"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <QrCode className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-lg sm:text-xl font-bold">Mark Attendance</h3>
                <p className="text-blue-100 text-sm">Scan QR code or use facial recognition</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 hidden sm:flex">
              →
            </div>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12">
          {/* Attendance Percentage */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  Good
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">Attendance Rate</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {attendancePercentage}%
              </h3>
              <p className="text-xs text-gray-500">Based on your recorded classes</p>
            </CardContent>
          </Card>

          {/* Days Present */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  Present
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">Days Present</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {daysPresent}
              </h3>
              <p className="text-xs text-gray-500">This semester</p>
            </CardContent>
          </Card>

          {/* Days Absent */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  Absent
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">Days Absent</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {daysAbsent}
              </h3>
              <p className="text-xs text-gray-500">This semester</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Today's Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Your classes for today will appear here once your timetable is available.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
