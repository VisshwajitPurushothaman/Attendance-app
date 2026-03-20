import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  QrCode,
  Camera,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Webcam from "react-webcam";
import { Scanner } from "@yudiel/react-qr-scanner";

// Declare face-api types
declare global {
  interface Window {
    faceapi: any;
  }
}

// Global flag to track if models are loaded to avoid duplicate loading
let modelsLoading = false;
let modelsLoaded = false;

export default function AttendanceMarking() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1); // 1: QR, 2: Face, 3: Result
  const [method, setMethod] = useState<"qr" | "facial" | "hybrid">("hybrid");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [hasFaceRegistered, setHasFaceRegistered] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [location, setLocation] = useState<{ latitude: string; longitude: string } | null>(null);

  const webcamRef = useRef<Webcam>(null);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);

      // Check if user has face registered
      if (parsedUser.id) {
        checkFaceRegistration(parsedUser.id);
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const checkFaceRegistration = async (userId: number) => {
    try {
      const response = await fetch(`/api/face/has-face/${userId}`);
      const data = await response.json();
      setHasFaceRegistered(data.hasFace);
    } catch (error) {
      console.error("Failed to check face registration", error);
    }
  };

  const loadFaceAPIModels = async () => {
    if (!window.faceapi) {
      throw new Error("face-api.js not loaded. Please refresh the page.");
    }

    // Return early if models already loaded
    if (modelsLoaded) {
      return true;
    }

    // Prevent duplicate loading
    if (modelsLoading) {
      // Wait for models to finish loading
      let attempts = 0;
      while (modelsLoading && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      if (modelsLoaded) return true;
      throw new Error("Models took too long to load");
    }

    modelsLoading = true;
    setIsLoadingModels(true);

    try {
      // Use faster CDN (CDN.js is faster than raw.githubusercontent)
      // Falls back to github if cdnjs fails
      const CDN_URLS = [
        "https://raw.githubusercontent.com/vladmandic/face-api/master/model/",
        "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/",
      ];

      let modelUrl = CDN_URLS[0];

      try {
        // Try primary CDN first with quick timeout check
        const checkResponse = await Promise.race([
          fetch(modelUrl + "tiny_face_detector_model-weights_manifest.json"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
        ]) as Response;
        if (!checkResponse.ok) throw new Error("Primary CDN failed");
      } catch {
        // Fallback to secondary CDN
        modelUrl = CDN_URLS[1];
      }

      // Load models in parallel for faster loading
      const startTime = performance.now();

      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        window.faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        window.faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
      ]);

      const loadTime = performance.now() - startTime;
      console.log(`✓ Face models loaded in ${loadTime.toFixed(0)}ms`);

      modelsLoaded = true;
      modelsLoading = false;
      setIsLoadingModels(false);
      return true;
    } catch (error: any) {
      modelsLoading = false;
      setIsLoadingModels(false);
      console.error("Failed to load face-api models:", error);
      throw new Error("Failed to load face recognition models. Please check your internet connection and try again.");
    }
  };

  // Compress image to reduce file size while maintaining quality for facial recognition
  const compressImage = (base64String: string, quality = 0.92, scaleFactor = 0.97): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Keep resolution high to preserve facial features for encoding consistency
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(base64String);
        }
      };
      img.src = base64String;
    });
  };

  const detectAndEncodeFace = async (imageSrc: string): Promise<number[]> => {
    if (!window.faceapi) {
      throw new Error("face-api.js not loaded");
    }

    const startTime = performance.now();
    const img = await window.faceapi.fetchImage(imageSrc);

    // Use optimized TinyFaceDetector options for faster processing
    const options = new window.faceapi.TinyFaceDetectorOptions({
      inputSize: 320, // Reduced from default for faster processing
      scoreThreshold: 0.5,
    });

    // Detect face with landmarks - skip re-detection for speed
    const detections = await window.faceapi
      .detectSingleFace(img, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    const processTime = performance.now() - startTime;
    console.log(`✓ Face detected and encoded in ${processTime.toFixed(0)}ms`);

    if (!detections) {
      throw new Error("No face detected. Please ensure your face is clearly visible.");
    }

    // Return the face descriptor as an array
    return Array.from(detections.descriptor);
  };

  const storeFaceEncoding = async (userId: number, encoding: number[], imageData: string) => {
    const response = await fetch("/api/face/store-face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, encoding, imageData }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to store face encoding");
    }

    return await response.json();
  };

  const verifyFaceMatch = async (userId: number, encoding: number[]): Promise<boolean> => {
    const response = await fetch("/api/face/verify-face", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, encoding, threshold: 0.80 }), // Increased to 80% similarity needed for reliability
    });

    if (!response.ok) {
      const data = await response.json();
      if (data.needsRegistration) {
        throw new Error("No face registered. Please register your face first.");
      }
      throw new Error(data.message || "Face verification failed");
    }

    const data = await response.json();
    return data.match;
  };

  const markAttendance = async (method: "hybrid", faceMatchVerified: boolean) => {
    if (!user || !sessionId) return;

    try {
      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          sessionId,
          method: "hybrid",
          status: "present",
          qrVerified: true,
          faceMatchVerified,
          latitude: location?.latitude,
          longitude: location?.longitude,
        })
      });

      if (response.ok) {
        setScanResult({
          success: true,
          message: `Attendance marked successfully for ${sessionInfo?.subject} via 2-Step Verification!`
        });
        setCurrentStep(3);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to mark attendance");
      }
    } catch (error: any) {
      setScanResult({
        success: false,
        message: error.message || "Failed to mark attendance. Please try again."
      });
      setCurrentStep(3);
    }
  };

  const requestLocation = () => {
    return new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser");
        resolve(); // Continue without location
        return;
      }
      
      // Ask for permission explicitly before triggering the browser's native prompt
      if (!window.confirm("Allow AttendanceApp to access your location for this session? This helps verify your presence in class.")) {
        toast.warning("Location access skipped. Attendance will be marked without location.");
        resolve(); // Continue without location
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
          resolve();
        },
        (error) => {
          console.error("Error getting location", error);
          toast.warning("Failed to get location, marking attendance without it.");
          resolve(); // Continue without location
        },
        { timeout: 10000 }
      );
    });
  };

  const handleManualCodeSubmit = async () => {
    if (!manualCode.trim()) {
      toast.error("Please enter a code");
      return;
    }

    setIsVerifyingCode(true);
    setCameraError(null);
    try {
      const response = await fetch(`/api/sessions/verify/${manualCode.trim()}`);
      const data = await response.json();

      if (response.ok && data.valid) {
        setSessionId(data.session.id);
        setSessionInfo(data.session);
        setCurrentStep(2);
        
        // Request location when moving to step 2
        await requestLocation();

        if (!modelsLoaded) {
          loadFaceAPIModels().catch(console.error);
        }
      } else {
        setCameraError(data.message || "Invalid or expired code");
      }
    } catch (error) {
      setCameraError("Failed to verify code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleQRScan = async (result: any) => {
    if (result && currentStep === 1) {
      const code = result[0]?.rawValue;
      if (code) {
        try {
          const response = await fetch(`/api/sessions/verify/${code}`);
          const data = await response.json();

          if (response.ok && data.valid) {
            setSessionId(data.session.id);
            setSessionInfo(data.session);

            // Success - move to next step
            setCurrentStep(2);

            // Request location when moving to step 2
            await requestLocation();

            // Load models if not already loaded
            if (!modelsLoaded) {
              loadFaceAPIModels().catch(console.error);
            }
          } else {
            setCameraError(data.message || "Invalid QR code");
          }
        } catch (error) {
          setCameraError("Failed to verify QR code");
        }
      }
    }
  };

  const captureFace = async () => {
    if (!user) return;

    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      console.error("❌ Webcam screenshot returned null. Ready state:", isWebcamReady);
      setCameraError("Failed to capture image. Please ensure your camera is visible and try again.");
      return;
    }

    console.log("📸 Image captured successfully, size:", Math.round(imageSrc.length / 1024), "KB");

    setIsProcessingFace(true);
    setCameraError(null);

    try {
      const totalStartTime = performance.now();

      // Load models if not already loaded
      if (!modelsLoaded) {
        await loadFaceAPIModels();
      }

      // Compress image for faster processing (85% quality, 95% size - maintains facial features)
      const compressStartTime = performance.now();
      const compressedImage = await compressImage(imageSrc, 0.85);
      const compressTime = performance.now() - compressStartTime;
      console.log(`✓ Image prepared in ${compressTime.toFixed(0)}ms`);

      // Detect and encode face
      const encoding = await detectAndEncodeFace(compressedImage);

      // Check if user has face registered
      if (hasFaceRegistered === false || hasFaceRegistered === null) {
        // First time - store the face and image
        await storeFaceEncoding(user.id, encoding, compressedImage);
        setHasFaceRegistered(true);
        setScanResult({
          success: true,
          message: "Face registered successfully! 2-Step Verification complete."
        });
        // Mark attendance after storing face
        await markAttendance("hybrid", true);
      } else {
        // Verify face match
        const matches = await verifyFaceMatch(user.id, encoding);

        if (matches) {
          // Face matches - mark attendance
          await markAttendance("hybrid", true);
        } else {
          setScanResult({
            success: false,
            message: "Face does not match. Please try again or contact support."
          });
          setCurrentStep(3);
        }
      }

      const totalTime = performance.now() - totalStartTime;
      console.log(`✅ Total face recognition process: ${totalTime.toFixed(0)}ms`);
    } catch (error: any) {
      setCameraError(error.message || "Failed to process face. Please try again.");
      setScanResult({
        success: false,
        message: error.message || "Face recognition failed. Please try again."
      });
      setCurrentStep(3);
    } finally {
      setIsProcessingFace(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSessionId(null);
    setSessionInfo(null);
    setScanResult(null);
    setCameraError(null);
    setIsScanning(true);
    setIsProcessingFace(false);
  };

  const startScanning = async (selectedMethod: "qr" | "facial") => {
    setMethod(selectedMethod);
    setIsScanning(true);
    setCameraError(null);

    // Load face-api models when facial recognition is selected
    if (selectedMethod === "facial" && !modelsLoaded) {
      try {
        await loadFaceAPIModels();
      } catch (error: any) {
        setCameraError("Failed to load face recognition models. Please refresh the page.");
        setIsScanning(false);
        return;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 active:bg-gray-100 hover:bg-gray-100 rounded-lg transition touch-none"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mark Attendance</h1>
          </div>

          {/* Step Indicator */}
          {currentStep < 3 && (
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
              <div className={`w-4 h-0.5 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= 2 ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        {currentStep === 1 ? (
          <>
            {/* Step 1: QR Scan */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 1: Scan Teacher's QR</h2>
              <p className="text-gray-600">Scan the active session code from your teacher's dashboard</p>
            </div>

            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0 relative bg-black min-h-[400px] flex flex-col">
                <div className="relative flex-1">
                  <Scanner
                    onScan={handleQRScan}
                    onError={(error: unknown) => {
                      const msg = error instanceof Error ? error.message : "QR Error";
                      setCameraError(msg);
                    }}
                    components={{ finder: true }}
                    styles={{
                      container: { width: "100%", height: "100%" },
                      video: { width: "100%", height: "100%", objectFit: "cover" }
                    }}
                  />
                  <div className="absolute top-0 left-0 right-0 p-4 bg-black/50 text-white text-center z-10">
                    <p>Align QR code in the frame</p>
                  </div>
                </div>
                {cameraError && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-red-500 text-white text-center">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {cameraError}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-blue-50/50 px-4 text-gray-500 backdrop-blur-sm">OR ENTER CODE MANUALLY</span>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Enter session code..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="h-12 bg-white border-2 border-blue-100 focus:border-blue-500 transition-all text-center text-lg font-bold tracking-widest uppercase"
                  />
                </div>
                <Button
                  onClick={handleManualCodeSubmit}
                  disabled={isVerifyingCode}
                  className="h-12 px-6 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  {isVerifyingCode ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : currentStep === 2 ? (
          <>
            {/* Step 2: Facial Recognition */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
                <CheckCircle className="w-4 h-4" />
                QR Verified: {sessionInfo?.subject}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Step 2: Face Verification</h2>
              <p className="text-gray-600">Position your face clearly in the camera</p>
            </div>

            <Card className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0 relative bg-black min-h-[400px] flex flex-col">
                {isLoadingModels ? (
                  <div className="flex-1 flex items-center justify-center text-white text-center p-8">
                    <div>
                      <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                      <p className="text-lg font-medium">Loading Facial Models</p>
                      <p className="text-sm text-gray-400">This might take a few seconds on first load...</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex-1 flex flex-col">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      className="w-full h-full object-cover flex-1"
                      videoConstraints={{ facingMode: "user" }}
                      onUserMedia={() => setIsWebcamReady(true)}
                    />

                    <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 z-10">
                      <Button
                        onClick={captureFace}
                        disabled={isProcessingFace || !isWebcamReady}
                        className="rounded-full w-20 h-20 bg-white hover:bg-gray-100 border-4 border-teal-500 flex items-center justify-center shadow-xl disabled:opacity-50 transition-transform active:scale-95"
                      >
                        {isProcessingFace ? (
                          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
                        ) : (
                          <Camera className={`w-10 h-10 ${isWebcamReady ? 'text-teal-600' : 'text-gray-300'}`} />
                        )}
                      </Button>

                      {isProcessingFace && (
                        <div className="bg-black/60 text-white px-6 py-2 rounded-full backdrop-blur-md animate-pulse">
                          Verifying Face Identity...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-red-500 text-white text-center z-20">
                    <div className="flex items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {cameraError}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <button
              onClick={() => setCurrentStep(1)}
              className="mt-6 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 w-full text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Re-scan QR Code
            </button>
          </>
        ) : (
          /* Result Screen (already handled in previous version but I'll update it for 2-step) */
          <>
            {/* Success/Result Screen */}
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  {scanResult.success ? (
                    <>
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        Success!
                      </h2>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        Failed
                      </h2>
                    </>
                  )}

                  <p className="text-lg text-gray-600 mb-8">
                    {scanResult.message}
                  </p>

                  <div className="space-y-3">
                    <Button
                      onClick={() => navigate("/dashboard")}
                      className="w-full h-11 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-semibold"
                    >
                      Back to Dashboard
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="w-full h-11"
                    >
                      Mark Another
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
