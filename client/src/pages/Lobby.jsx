import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Lobby() {
    const [blocks, setBlocks] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        axios
            .get(`${import.meta.env.VITE_BACKEND_URL}/codeblocks`)
            .then((res) => setBlocks(res.data))
            .catch((err) => console.error("Failed to fetch blocks:", err));
    }, []);

    return (
        <div style={{ padding: "2rem" }}>
            <h1>Choose Code Block</h1>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {blocks.map((block) => (
                    <li key={block._id} style={{ margin: "1rem 0" }}>
                        <button
                            onClick={() => navigate(`/code/${block._id}`)}
                            style={{
                                padding: "1rem",
                                border: "1px solid #ccc",
                                backgroundColor: "#f0f0f0",
                                cursor: "pointer",
                                borderRadius: "8px",
                            }}
                        >
                            {block.title}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}