import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Users, BookOpen, Settings, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RoleSelection() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | "admin" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    if (userRole) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const roles: {
    id: "student" | "teacher" | "admin";
    name: string;
    description: string;
    icon: typeof Users;
    color: string;
  }[] = [
    {
      id: "student",
      name: "Student",
      description: "Mark attendance, view statistics, and manage your profile",
      icon: Users,
      color: "from-blue-600 to-blue-700",
    },
    {
      id: "teacher",
      name: "Teacher",
      description: "Manage students, view attendance records, and create classes",
      icon: BookOpen,
      color: "from-teal-600 to-teal-700",
    },
    {
      id: "admin",
      name: "Administrator",
      description: "Control the app, manage users, and view system analytics",
      icon: Settings,
      color: "from-orange-600 to-orange-700",
    },
  ];

  const handleContinue = async () => {
    if (!selectedRole) return;

    setIsLoading(true);
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        window.location.href = "/login";
        return;
      }

      const user = JSON.parse(userStr) as { id: number } & Record<string, unknown>;

      const response = await fetch("/api/auth/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: selectedRole }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Failed to save role");
      }

      const updatedUser = data.user ?? { ...user, role: selectedRole, selectedRole };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      localStorage.setItem("userRole", selectedRole);

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Failed to save role selection", error);
      alert("Could not save your role selection. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex flex-col">
      {/* Header */}
      <div className="py-4 sm:py-6 px-3 sm:px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AttendanceApp</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Select Your Role
            </h2>
            <p className="text-base sm:text-lg text-gray-600">
              Choose how you'll use AttendanceApp
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;

              return (
                <Card
                  key={role.id}
                  className={`cursor-pointer transition-all duration-200 border-2 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50 shadow-lg"
                      : "border-transparent hover:shadow-lg"
                  }`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <CardContent className="pt-8 text-center">
                    <div
                      className={`w-16 h-16 mx-auto mb-4 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center`}
                    >
                      <Icon className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {role.name}
                    </h3>

                    <p className="text-gray-600 text-sm">
                      {role.description}
                    </p>

                    {isSelected && (
                      <div className="mt-6 flex justify-center">
                        <div className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                          Selected
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleContinue}
              disabled={!selectedRole || isLoading}
              className="px-8 h-12 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold inline-flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
