import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ArrowLeft, MapPin, CheckCircle2, XCircle, Clock, Users, Loader2 } from "lucide-react";

export default function SessionReport() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData(parseInt(sessionId));
    }
  }, [sessionId]);

  const fetchSessionData = async (id: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sessions/${id}/attendance`);
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        setAttendance(data.attendance || []);
      }
    } catch (error) {
      console.error("Error fetching session data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openGoogleMaps = (lat: string, lng: string) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const exportToCSV = () => {
    if (!session || !attendance) return;

    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;

    const sessionInfo = [
      ["Session Subject", session.subject],
      ["Date", new Date(session.createdAt).toLocaleDateString()],
      ["Time", new Date(session.createdAt).toLocaleTimeString()],
      ["Total Students", attendance.length.toString()],
      ["Present", presentCount.toString()],
      ["Late", lateCount.toString()],
      [""],
      ["Student Name", "Email", "Status", "Time Marked", "Method", "Latitude", "Longitude", "Map Link"]
    ];

    const studentRows = attendance.map(record => [
      `"${record.name}"`,
      `"${record.email}"`,
      record.status.toUpperCase(),
      new Date(record.date).toLocaleTimeString(),
      record.method.toUpperCase(),
      record.latitude || "N/A",
      record.longitude || "N/A",
      record.latitude && record.longitude ? `https://www.google.com/maps?q=${record.latitude},${record.longitude}` : "N/A"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + sessionInfo.map(e => e.join(",")).join("\n")
      + "\n"
      + studentRows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${session.subject}_Attendance.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full text-center p-8">
          <h2 className="text-xl font-bold mb-4">Session Not Found</h2>
          <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
        </Card>
      </div>
    );
  }

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{session.subject} - Session Report</h1>
              <p className="text-sm text-gray-500">
                {new Date(session.createdAt).toLocaleDateString()} at {new Date(session.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900">{attendance.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Present</p>
                <p className="text-2xl font-bold text-gray-900">{presentCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Late</p>
                <p className="text-2xl font-bold text-gray-900">{lateCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Attendance Record</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No attendance records found for this session yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Time Marked</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Method</th>
                      <th className="px-6 py-3">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record, idx) => (
                      <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{record.name}</td>
                        <td className="px-6 py-4 text-gray-500">{record.email}</td>
                        <td className="px-6 py-4 text-gray-500">
                          {new Date(record.date).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'present' ? 'bg-green-100 text-green-700' :
                            record.status === 'late' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium uppercase">
                            {record.method}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {record.latitude && record.longitude ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs text-gray-600 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                {Number(record.latitude).toFixed(4)}, {Number(record.longitude).toFixed(4)}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 h-auto -ml-2"
                                onClick={() => openGoogleMaps(record.latitude, record.longitude)}
                              >
                                <MapPin className="w-4 h-4 mr-1" />
                                View Map
                              </Button>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic flex items-center text-xs">
                              <XCircle className="w-3 h-3 mr-1" /> No location
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
