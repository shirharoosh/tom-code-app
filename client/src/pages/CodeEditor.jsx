import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import Editor from "@monaco-editor/react";
import socket from "../socket";
import Confetti from "react-confetti"

export default function CodeEditor() {
    const { id } = useParams(); // grab block ID from URL
    const [block, setBlock] = useState(null);
    const [code, setCode] = useState("");
    const [role, setRole] = useState("");
    const [solution, setSolution] = useState("");
    const [isSolved, setIsSolved] = useState(false);
    const [studentCount, setStudentCount] = useState(0);

    // 🔁 1. Join room and assign role
    useEffect(() => {
        setRole("");
        console.log("🧠 useEffect triggered with ID:", id);

        // 🔁 1. Fetch the code block data from the backend
        axios
            .get(`${import.meta.env.VITE_BACKEND_URL}/codeblocks/${id}`)
            .then((res) => {
                console.log("✅ Fetched block:", res.data);
                setBlock(res.data);
                setCode(res.data.template);
                setSolution(res.data.solution);
            })
            .catch((err) => {
                console.error("Error loading code block:", err);
            });
        
        // 🔗 2. Connect and join room only if not already connected
        if (!socket.connected) {
            socket.connect();
            console.log("🔌 Socket connected manually");
        }

        socket.emit("join-room", id);

        console.log("📨 Sent join-room for ID:", id);

        socket.on("role-assigned", (assignedRole) => {
            console.log("🎭 Role assigned:", assignedRole);
            setRole(assignedRole);
        });

        // Listen for incoming code changes
        socket.on("receive-code", (incomingCode) => {
            setCode(incomingCode);
        });

        // Listen for student count updates
        socket.on("student-count", (count) => {
            setStudentCount(count);
        });

        // Listen for reset-code
        socket.on("reset-code", (template) => {
            setCode(template);      // reset code
            setIsSolved(false);     // hide smiley & confetti
        });

        // ❌ 3. Clean up
        return () => {
            socket.emit("leave-room", id);
            socket.off("role-assigned");
            socket.off("receive-code");
            socket.off("student-count");
            socket.off("reset-code");
            console.log("👋 Left room");
        };
    }, [id]);

    // 🧠 2. Listen for mentor leaving (only students will react to this)
    useEffect(() => {
        socket.on("mentor-left", () => {
          alert("👋 Mentor has left the room. You will be redirected.");
          window.location.href = "/";
        });
    
        return () => {
          socket.off("mentor-left");
        };
      }, []);
    

    if (!block) {
        return <p style={{ padding: "2rem" }}>⏳ Loading code block...</p>;
    } 

    return (
        <div
            style={{
                position: "relative",
                width: "100vw",
                height: "100vh",
                margin: 0,
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}
        >   
            {/* Header */}
            <div style={{ padding: "1rem", backgroundColor: "#1e1e1e", color: "white" }}>
                <h2 style={{ margin: 0 }}>{block?.title || "Loading..."}</h2>
                <p style={{ margin: 0, fontSize: "14px", opacity: 0.7 }}>
                    Role: <strong>{role || "Loading..."}</strong>
                </p>
                <p>Students in room: {studentCount}</p>
            </div>

            {/* Monaco Editor */}
            <div style={{ flexGrow: 1 }}>
                <Editor
                    key={role}
                    height="100%"
                    width="100%"
                    defaultLanguage="javascript"
                    value={code}
                    onChange={(value) => {
                        if (role === "student") {
                            console.log("✏️ Emitting code update:", value);
                            setCode(value);
                            socket.emit("code-update", { roomId: id, code: value });
                            
                            if (value.trim() === solution.trim()) {
                                setIsSolved(true);
                            } else {
                                setIsSolved(false);
                            }
                        }
                    }}
                    theme="vs-dark"
                    options={{
                        readOnly: role === "mentor" || isSolved, //✅ read-only for mentor
                        minimap: { enabled: false },
                        fontSize: 14,
                    }}
                />
            </div>

            {/* ✅ Smiley face and confetti */}
            {isSolved && (
                <>
                    <Confetti
                        width={window.innerWidth}
                        height={window.innerHeight}
                        recycle={false}
                        numberOfPieces={300}
                        gravity={0.3}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: "30%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            fontSize: "100px",
                            zIndex: 10,
                        }}
                    >
                        😄
                    </div>
                </>
            )}
        </div>
    );
}
