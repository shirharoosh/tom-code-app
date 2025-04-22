const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const CodeBlock = require('./modules/CodeBlock');
const mentors = {};

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());


// Mongo DB connection
mongoose.connect(
    "mongodb+srv://tom-js-instructor:Tom123@cluster0.c0p515r.mongodb.net/tom_code_platform?retryWrites=true&w=majority&appName=Cluster0", 
    { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));


// Test route
app.get("/", (req, res) => {
    res.send("Server is up!");
});


// ✅ Route: GET all code blocks (used by Lobby page)
app.get("/codeblocks", async (req, res) => {
    try {
      const blocks = await CodeBlock.find();
      res.json(blocks);
    } catch (err) {
      console.error("Error fetching blocks:", err);
      res.status(500).json({ error: "Failed to fetch code blocks" });
    }
  });


// ✅ Route: GET single block by ID (used by /code/:id)
app.get("/codeblocks/:id", async (req, res) => {
  try {
    const block = await CodeBlock.findById(req.params.id);
    if (!block) {
      return res.status(404).json({ error: "Code block not found" });
    }
    res.json(block);
  } catch (err) {
    console.error("Error getting code block:", err);
    res.status(500).json({ error: "Could not fetch code block" });
  }
});


// 🧠 Socket.IO real-time connection placeholder (to expand later)
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // 👉 Join a specific room
    socket.on("join-room", async (roomId) => {
        socket.join(roomId);

        const clients = await io.in(roomId).fetchSockets();
        const isMentor = !mentors[roomId]; // First join = mentor

        // Initialize room if not present
        if (isMentor) {
            mentors[roomId] = socket.id;
        }

        roomUsers[roomId].push(socket.id);

        const assignedRole = isMentor ? "mentor" : "student";

        console.log(`🎭 ${assignedRole} joined room ${roomId}: ${socket.id}`);

        socket.emit("role-assigned", assignedRole);

        const studentCount = clients.length - 1;

        // Notify other users (e.g., student count)
        io.to(roomId).emit("student-count", studentCount);
    });

    
    // Handle Code update
    socket.on("code-update", ({ roomId, code }) => {
        // Send to everyone in the room EXCEPT the one who sent it
        socket.to(roomId).emit("receive-code", code);
    });        

    // 👉 Leave room
    socket.on("leave-room", (roomId) => {
        socket.leave(roomId);
        roomUsers[roomId] = roomUsers[roomId]?.filter((id) => id !== socket.id);

        // Emit updated student count
        io.to(roomId).emit("student-count", roomUsers[roomId].length - 1);

        console.log(`👋 ${socket.id} left room ${roomId}`);
    });

    // 👉 Handle disconnect
    socket.on("disconnect", async() => {
        console.log("🔴 User disconnected:", socket.id);

        // Clean up all rooms this socket was in
        for (const roomId in mentors) {
            const socketsInRoom = await io.in(roomId).fetchSockets();
            const remainingSockets = socketsInRoom.filter(s => s.id !== socket.id);

            // If the disconnected user was the mentor
            if (mentors[roomId] === socket.id) {
                console.log(`👋 Mentor left room ${roomId}. Kicking students.`);

                try {
                    const block = await CodeBlock.findById(roomId);
                    if (block) {
                        io.to(roomId).emit("reset-code", block.template); // ✅ send original template
                    }
                } catch (err) {
                    console.error("❌ Failed to fetch code block template:", err);
                }

                // Notify all students in the room in a slight delay
                setTimeout(() => {
                    io.to(roomId).emit("mentor-left");
                    delete mentors[roomId];
                    console.log(`🧹 Room ${roomId} cleaned up after mentor left.`);
                }, 500);
            }

            // 🧹 If the room is now empty, clean up mentor tracking
            if (remainingSockets.length === 0) {
                delete mentors[roomId];
                console.log(`🧹 Room ${roomId} is empty. Cleaned up.`);
            } else {
                // Broadcast updated student count
                io.to(roomId).emit("student-count", remainingSockets.length - 1);
            }
        }
    });
});

// 🚀 Start the server
const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
