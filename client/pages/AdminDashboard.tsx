import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  User,
  LogOut,
  Users,
  BarChart3,
  Settings,
  AlertCircle,
  UserPlus,
  Trash2,
  Edit,
  QrCode as QrIcon,
  Loader2,
} from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [sessionSubject, setSessionSubject] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [selectedAllocationTeacher, setSelectedAllocationTeacher] = useState("");
  const [selectedAllocationSection, setSelectedAllocationSection] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState<Record<number, string>>({});
  const [isAllocating, setIsAllocating] = useState(false);

  // Edit User State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "",
  });

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserName(user.name || "Admin");
      setProfilePhoto(user.profilePhoto || null);
    } else {
      setUserName(localStorage.getItem("userName") || "Admin");
    }
    fetchUsers();
    fetchSections();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/auth/users");
      const data = await response.json();
      setUsersList(data.users || []);
      // Map role to lowercase before comparison if needed, though schema says varchar
      setTeachers(data.users?.filter((u: any) => u.role?.toLowerCase() === "teacher") || []);

      const subjects: Record<number, string> = {};
      data.users?.forEach((u: any) => {
        if (u.role?.toLowerCase() === 'teacher' && u.subject) {
          subjects[u.id] = u.subject;
        }
      });
      setTeacherSubjects(subjects);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await fetch("/api/sections");
      const data = await response.json();
      setSections(data.sections || []);
    } catch (error) {
      console.error("Failed to fetch sections", error);
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName) return;
    try {
      const response = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSectionName }),
      });
      if (response.ok) {
        toast.success("Section created successfully");
        setNewSectionName("");
        fetchSections();
      }
    } catch (error) {
      toast.error("Failed to create section");
    }
  };

  const handleAllocateTeacher = async () => {
    if (!selectedAllocationTeacher || !selectedAllocationSection) return;
    setIsAllocating(true);
    try {
      const response = await fetch("/api/sections/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: parseInt(selectedAllocationTeacher),
          sectionId: parseInt(selectedAllocationSection),
        }),
      });
      if (response.ok) {
        toast.success("Teacher allocated successfully");
        setSelectedAllocationSection("");
        setSelectedAllocationTeacher("");
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to allocate teacher");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsAllocating(false);
    }
  };

  const handleUpdateTeacherSubject = async (teacherId: number, subject: string) => {
    try {
      const response = await fetch("/api/sections/teacher-subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, subject }),
      });
      if (response.ok) {
        toast.success("Subject updated successfully");
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to update subject");
    }
  };

  const handleAssignStudentToSection = async (studentId: number, sectionId: string) => {
    try {
      const sId = sectionId === "none" ? null : parseInt(sectionId);
      const response = await fetch("/api/sections/assign-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, sectionId: sId }),
      });
      if (response.ok) {
        toast.success("Student section updated");
        fetchUsers();
      }
    } catch (error) {
      toast.error("Failed to assign section");
    }
  };

  const handleCreateSession = async () => {
    if (!selectedTeacherId || !sessionSubject) {
      toast.error("Please select a teacher and enter a subject");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: parseInt(selectedTeacherId),
          subject: sessionSubject,
          durationMinutes: 60,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setActiveSession(data.session);
        setSessionSubject("");
        toast.success("Attendance session started for teacher!");
      } else {
        toast.error(data.message || "Failed to create session");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleQrAccess = async (userId: number, currentAccess: boolean) => {
    try {
      const response = await fetch("/api/auth/toggle-qr-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, access: !currentAccess }),
      });

      if (response.ok) {
        toast.success(`QR Access ${!currentAccess ? 'granted' : 'revoked'}`);
        fetchUsers(); // Refresh list
      } else {
        toast.error("Failed to update access");
      }
    } catch (error) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("User deleted successfully");
        fetchUsers(); // Refresh the list
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Delete user error:", error);
      toast.error("An error occurred while deleting the user");
    }
  };

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role || "student",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        toast.success("User updated successfully");
        setIsEditModalOpen(false);
        fetchUsers(); // Refresh the list
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to update user");
      }
    } catch (error) {
      console.error("Update user error:", error);
      toast.error("An error occurred while updating the user");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const stats = {
    totalUsers: usersList.length,
    students: usersList.filter((u) => u.role?.toLowerCase() === "student").length,
    teachers: usersList.filter((u) => u.role?.toLowerCase() === "teacher").length,
    admins: usersList.filter((u) => u.role?.toLowerCase() === "admin").length,
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
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full ml-2 hidden sm:inline-block">
              Admin
            </span>
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
            Admin Dashboard
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">Manage the application and all users</p>
        </div>

        {/* QR Generation Section (For Teachers) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 sm:mb-12">
          {/* Create Session Card */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Generate QR for Teacher</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Select Teacher
                  </label>
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id.toString()}>
                          {teacher.name} ({teacher.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <Button
                  onClick={handleCreateSession}
                  disabled={isGenerating}
                  className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrIcon className="w-4 h-4" />
                  )}
                  Generate QR Code
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active QR Code Display */}
          <Card className="border-0 shadow-md flex flex-col items-center justify-center min-h-[300px]">
            {activeSession ? (
              <CardContent className="pt-6 text-center">
                <div className="bg-white p-4 rounded-xl shadow-inner mb-4 inline-block border border-gray-100">
                  <QRCode
                    value={activeSession.code}
                    size={180}
                    level="H"
                  />
                </div>
                <h4 className="font-bold text-lg text-gray-900">{activeSession.subject}</h4>
                <p className="text-sm text-gray-500 mb-2">Code: {activeSession.code}</p>
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-green-600 bg-green-50 py-1 px-3 rounded-full mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active Session Generated
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
                <p className="text-gray-500 font-medium">No session generated</p>
                <p className="text-sm text-gray-400">Select a teacher and subject to generate a QR</p>
              </div>
            )}
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Total Users</p>
              <h3 className="text-4xl font-bold text-gray-900">
                {stats.totalUsers}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Students</p>
              <h3 className="text-4xl font-bold text-gray-900">
                {stats.students}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Teachers</p>
              <h3 className="text-4xl font-bold text-gray-900">
                {stats.teachers}
              </h3>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2">Admins</p>
              <h3 className="text-4xl font-bold text-gray-900">
                {stats.admins}
              </h3>
            </CardContent>
          </Card>
        </div>

        {/* Sections Management */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 sm:mb-12">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Create & Allocate Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Create New Section</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Section Name (e.g. A, B, CS101)"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                  />
                  <Button onClick={handleCreateSection} className="bg-teal-600 hover:bg-teal-700">Add</Button>
                </div>
              </div>

              <hr />

              {/* Allocate Teacher */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-gray-700">Allocate Teacher to Section</label>
                <div className="grid grid-cols-1 gap-3">
                  <Select value={selectedAllocationTeacher} onValueChange={setSelectedAllocationTeacher}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedAllocationSection} onValueChange={setSelectedAllocationSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAllocateTeacher}
                    disabled={isAllocating}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {isAllocating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Allocate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Teacher Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto space-y-3">
                {teachers.map(teacher => (
                  <div key={teacher.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-sm">{teacher.name}</span>
                      <span className="text-xs text-gray-500">{teacher.email}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Assigned Subject"
                        defaultValue={teacher.subject || ""}
                        onBlur={(e) => handleUpdateTeacherSubject(teacher.id, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle>User Management</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 inline-flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start text-sm">
                <UserPlus className="w-4 h-4" />
                Add User
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {usersList.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg active:bg-gray-200 hover:bg-gray-100 transition gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{user.email}</p>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${user.role?.toLowerCase() === "student"
                        ? "bg-blue-100 text-blue-700"
                        : user.role?.toLowerCase() === "teacher"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-orange-100 text-orange-700"
                        }`}
                    >
                      {user.role?.substring(0, 1).toUpperCase()}
                    </span>

                    {user.role?.toLowerCase() === "teacher" && (
                      <button
                        onClick={() => handleToggleQrAccess(user.id, user.canGenerateQr === 'true')}
                        className={`p-1.5 sm:p-2 rounded-lg transition touch-none flex items-center gap-1 text-xs font-medium ${user.canGenerateQr === 'true'
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          }`}
                        title={user.canGenerateQr === 'true' ? "Revoke QR Access" : "Grant QR Access"}
                      >
                        <QrIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {user.canGenerateQr === 'true' ? "Enabled" : "Disabled"}
                        </span>
                      </button>
                    )}

                    {user.role?.toLowerCase() === "student" && (
                      <Select
                        value={user.sectionId?.toString() || "none"}
                        onValueChange={(val) => handleAssignStudentToSection(user.id, val)}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue placeholder="Sec" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {sections.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <button
                      onClick={() => handleEditClick(user)}
                      className="p-1.5 sm:p-2 active:bg-gray-200 hover:bg-gray-200 rounded-lg transition touch-none"
                    >
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-1.5 sm:p-2 active:bg-red-200 hover:bg-red-100 rounded-lg transition touch-none"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main >

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input
                id="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(val) => setEditFormData({ ...editFormData, role: val })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateUser} className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
