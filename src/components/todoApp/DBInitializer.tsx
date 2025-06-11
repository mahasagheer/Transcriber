"use client";

import { useEffect, useState } from "react";
import { addDummyData } from "../../lib/db";

export default function DBInitializer() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initDB = async () => {
      try {
        await addDummyData();
        setIsInitialized(true);
      } catch (err) {
        console.error("Error initializing database:", err);
        setError("Failed to initialize database");
      }
    };

    initDB();
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
        {error}
      </div>
    );
  }

  return null; // This component doesn't render anything when successful
}
