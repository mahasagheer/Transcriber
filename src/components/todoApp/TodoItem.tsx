"use client";

import { useState } from "react";
import { Todo, updateTodo, deleteTodo } from "../../lib/db";

interface TodoItemProps {
  todo: Todo;
  onTodoUpdated: () => void;
  onTodoDeleted: () => void;
}

export default function TodoItem({
  todo,
  onTodoUpdated,
  onTodoDeleted,
}: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleComplete = async () => {
    setIsLoading(true);
    try {
      await updateTodo({
        ...todo,
        completed: !todo.completed,
      });
      onTodoUpdated();
    } catch (error) {
      console.error("Error updating todo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!todo.id) return;

    setIsLoading(true);
    try {
      await deleteTodo(todo.id);
      onTodoDeleted();
    } catch (error) {
      console.error("Error deleting todo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(todo.title);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return;

    setIsLoading(true);
    try {
      await updateTodo({
        ...todo,
        title: editTitle.trim(),
      });
      setIsEditing(false);
      onTodoUpdated();
    } catch (error) {
      console.error("Error updating todo:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(todo.title);
  };

  return (
    <div className="flex items-center justify-between p-4 mb-2 bg-white rounded-md shadow-sm border border-gray-100">
      {isEditing ? (
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            autoFocus
          />
          <button
            onClick={handleSaveEdit}
            disabled={isLoading || !editTitle.trim()}
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
          <button
            onClick={handleCancelEdit}
            disabled={isLoading}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-1">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={handleToggleComplete}
              disabled={isLoading}
              className="w-5 h-5 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
            />
            <span
              className={`${
                todo.completed ? "line-through text-gray-500" : ""
              }`}
            >
              {todo.title}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              disabled={isLoading}
              className="p-1 text-blue-500 hover:text-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="p-1 text-red-500 hover:text-red-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
