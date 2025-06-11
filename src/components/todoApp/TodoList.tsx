"use client";

import { useEffect, useState } from "react";
import { Todo, getAllTodos, clearTodos } from "../../lib/db";
import TodoItem from "./TodoItem";

interface TodoListProps {
  refreshTrigger: number;
}

export default function TodoList({ refreshTrigger }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTodos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allTodos = await getAllTodos();
      setTodos(allTodos);
    } catch (err) {
      console.error("Error loading todos:", err);
      setError("Failed to load todos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTodos();
  }, [refreshTrigger]);

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to clear all todos?")) {
      try {
        await clearTodos();
        loadTodos();
      } catch (err) {
        console.error("Error clearing todos:", err);
        setError("Failed to clear todos. Please try again.");
      }
    }
  };

  if (isLoading && todos.length === 0) {
    return <div className="text-center py-4">Loading todos...</div>;
  }

  if (error) {
    return <div className="text-center py-4 text-red-500">{error}</div>;
  }

  if (todos.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No todos yet. Add one above!
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Todos ({todos.length})</h2>
        <button
          onClick={handleClearAll}
          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Clear All
        </button>
      </div>
      <div className="space-y-2">
        {todos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onTodoUpdated={loadTodos}
            onTodoDeleted={loadTodos}
          />
        ))}
      </div>
    </div>
  );
}
