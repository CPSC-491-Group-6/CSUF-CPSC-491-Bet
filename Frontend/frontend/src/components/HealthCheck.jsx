import { useEffect, useState } from "react";
import {checkHealth} from "./../services/api"

function HealthCheck() {
    const [status, setStatus] = useState("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        async function loadHealth() {
            try {
                const data = await checkHealth();
                setStatus(data.status);
            } catch {
                setError("Unable to connect to backend.");
            } finally {
                setLoading(false);
            }  
        } 

        loadHealth();      
    }, [])

    if (loading) {
        return <p>Checking backend...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return <p>Backend status: {status}</p>
}

export default HealthCheck;