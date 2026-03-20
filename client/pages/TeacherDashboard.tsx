import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  User,
  LogOut,
  Users,
  TrendingUp,
  Search,
  ChevronRight,
  AlertCircle,
  Loader2,
  QrCode as QrIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import QRCode from "react-qr-code";
import { toast } from "sonner";

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionSubject, setSessionSubject] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [canGenerateQr, setCanGenerateQr] = useState(false);
  const [mySections, setMySections] = useState<any[]>([]);
  const [teacherSubject, setTeacherSubject] = useState("");
  const [students, setStudents] = useState<
    {
      id: number;
      name: string;
      email: string;
      attendance: number;
      daysPresent: number;
      daysAbsent: number;
    }[]
  >([]);

  useEffect(() => {
    const name = localStorage.getItem("userName") || "Teacher";
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserId(user.id);
      setProfilePhoto(user.profilePhoto || null);
      setCanGenerateQr(user.canGenerateQr === true || user.role?.toLowerCase() === 'admin');
      fetchActiveSession(user.id);
      fetchPermissions(user.id);
      fetchStudents(user.id);
      fetchMySections(user.id);

      // Pre-fill subject if available in localstorage/user object
      if (user.subject) {
        setSessionSubject(user.subject);
        setTeacherSubject(user.subject);
      }
    }
    setUserName(name);
  }, []);

  const fetchActiveSession = async (tid: number) => {
    try {
      const response = await fetch(`/api/sessions/active/${tid}`);
      const data = await response.json();
      if (data.sessions && data.sessions.length > 0) {
        setActiveSession(data.sessions[0]);
      }
    } catch (error) {
      console.error("Failed to fetch active session", error);
    }
  };

  const fetchPermissions = async (tid: number) => {
    try {
      const response = await fetch("/api/auth/users");
      const data = await response.json();
      const currentUser = data.users?.find((u: any) => u.id === tid);
      if (currentUser) {
        setCanGenerateQr(currentUser.canGenerateQr === 'true' || currentUser.role?.toLowerCase() === 'admin');

        if (currentUser.subject) {
          setTeacherSubject(currentUser.subject);
          if (!sessionSubject) setSessionSubject(currentUser.subject);
        }

        // Optionally update localStorage to keep it in sync
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          localStorage.setItem("user", JSON.stringify({
            ...user,
            canGenerateQr: currentUser.canGenerateQr === 'true',
            subject: currentUser.subject
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch permissions", error);
    }
  };

  const fetchMySections = async (tid: number) => {
    try {
      const response = await fetch(`/api/sections/teacher/${tid}`);
      const data = await response.json();
      if (data.sections) {
        setMySections(data.sections);
      }
    } catch (error) {
      console.error("Failed to fetch my sections", error);
    }
  };

  const fetchStudents = async (tid: number) => {
    // In a real app, this would fetch students allocated to this teacher's sections
    // For now, we'll fetch all students to populate the dashboard
    try {
      const response = await fetch("/api/auth/users");
      const data = await response.json();
      if (data.users) {
        const allStudents = data.users.filter((u: any) => u.role?.toLowerCase() === "student");
        // Map to the format expected by the UI
        setStudents(allStudents.map((s: any) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          attendance: 85, // Placeholder
          daysPresent: 17,
          daysAbsent: 3
        })));
      }
    } catch (error) {
      console.error("Failed to fetch students", error);
    }
  };

  const exportGlobalReport = () => {
    if (students.length === 0) return;

    const headers = ["Student Name", "Email", "Attendance %", "Days Present", "Days Absent"];
    const rows = students.map(s => [
      `"${s.name}"`, 
      `"${s.email}"`, 
      `${s.attendance}%`, 
      s.daysPresent.toString(), 
      s.daysAbsent.toString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Class_Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateSession = async () => {
    if (!sessionSubject) {
      toast.error("Please enter a subject");
      return;
    }

    if (!userId) return;

    setIsGenerating(true);
    try {
      const response = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: userId,
          subject: sessionSubject,
          sectionId: selectedSectionId ? parseInt(selectedSectionId) : null,
          durationMinutes: 60,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setActiveSession(data.session);
        setSessionSubject("");
        toast.success("Attendance session started!");
      } else {
        toast.error(data.message || "Failed to create session");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const averageAttendance =
    students.length > 0
      ? Math.round(
        students.reduce((sum, s) => sum + s.attendance, 0) / students.length
      )
      : 0;

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
          <p className="text-gray-600 text-sm sm:text-base">Manage your students and track attendance</p>
        </div>

        {/* QR Generation Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 sm:mb-12">
          {/* Create Session Card */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Start New Session</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Subject Name
                  </label>
                  <Input
                    placeholder="Enter subject (e.g., Mathematics)"
                    value={sessionSubject}
                    onChange={(e) => setSessionSubject(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Select Section
                  </label>
                  <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {mySections.map((section) => (
                        <SelectItem key={section.id} value={section.id.toString()}>
                          {section.name}
                        </SelectItem>
                      ))}
                      {mySections.length === 0 && (
                        <SelectItem value="none" disabled>No sections allocated</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleCreateSession}
                  disabled={isGenerating || !canGenerateQr}
                  className={`w-full flex items-center justify-center gap-2 ${canGenerateQr
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                    }`}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrIcon className="w-4 h-4" />
                  )}
                  {activeSession ? "Start New Session" : "Generate QR Code"}
                </Button>

                {!canGenerateQr && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      QR generation is currently restricted for your account. Please contact an administrator to request access.
                    </p>
                  </div>
                )}

                {activeSession && canGenerateQr && (
                  <p className="text-xs text-orange-600 text-center">
                    Note: Starting a new session will replace the current active one.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active QR Code Display */}
          <Card className="border-0 shadow-md flex flex-col items-center justify-center min-h-[300px]">
            {activeSession ? (
              <CardContent className="pt-6 text-center">
                <div className="bg-white p-4 rounded-xl shadow-inner mb-4 inline-block">
                  <QRCode
                    value={activeSession.code}
                    size={200}
                    level="H"
                  />
                </div>
                <h4 className="font-bold text-lg text-gray-900">{activeSession.subject}</h4>
                <p className="text-sm text-gray-500 mb-2">Code: {activeSession.code}</p>
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-green-600 bg-green-50 py-1 px-3 rounded-full mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active Session
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => navigate(`/sessions/${activeSession.id}/report`)}
                >
                  View Session Report
                </Button>
              </CardContent>
            ) : (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <QrIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No active session</p>
                <p className="text-sm text-gray-400">Generate a QR code to start taking attendance</p>
              </div>
            )}
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-8 sm:mb-12">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Total Students</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {students.length}
              </h3>
              <p className="text-xs text-gray-500">In your classes</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Average Attendance</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {averageAttendance}%
              </h3>
              <p className="text-xs text-gray-500">Class wide</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Students Below 80%</p>
              <h3 className="text-4xl font-bold text-gray-900 mb-1">
                {students.filter((s) => s.attendance < 80).length}
              </h3>
              <p className="text-xs text-gray-500">Needs attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Students List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle>Student List</CardTitle>
              <Button onClick={exportGlobalReport} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto text-sm">
                Export Report
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-base"
                />
              </div>
            </div>

            {/* Student Cards */}
            <div className="space-y-3">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg active:bg-gray-200 hover:bg-gray-100 transition cursor-pointer touch-none"
                  onClick={() => navigate(`/student/${student.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{student.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{student.email}</p>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-8 ml-2 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-gray-900">
                        {student.attendance}%
                      </p>
                      <p className="text-xs text-gray-500">Attendance</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900">
                        {student.attendance}%
                      </p>
                      <p className="text-xs text-gray-500">{student.daysPresent}P/{student.daysAbsent}A</p>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
