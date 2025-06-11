import { openDB, DBSchema } from "idb";

// Define the database schema
interface TodoDB extends DBSchema {
  todos: {
    key: number;
    value: Todo;
    indexes: { "by-date": Date };
  };
  media: {
    key: number;
    value: Media;
    indexes: { "by-date": Date };
  };
}

// Define the Todo type
export interface Todo {
  id?: number;
  title: string;
  completed: boolean;
  createdAt: Date;
}

// Define the Tag type
export interface Tag {
  name: string; // e.g., 'Meeting', 'Urgent', 'Feedback', etc.
  color: string; // e.g., '#f44336' for red, '#ff9800' for orange, etc.
}

// Example predefined tags (for reference, not exported)
const exampleTags: Tag[] = [
  { name: 'Angry', color: '#f44336' }, // red
  { name: 'Meeting', color: '#1976d2' }, // blue
  { name: 'Urgent', color: '#ff9800' }, // orange
  { name: 'Feedback', color: '#4caf50' }, // green
  { name: 'Client Call', color: '#9c27b0' }, // purple
];

// Define the Media type
export interface Media {
  id?: number;
  blob: Blob;
  type: string;
  name: string;
  createdAt: Date;
  transcript?: string;
  tags?: Tag[];
}

// Database name and version
const DB_NAME = "todo-db";
const DB_VERSION = 2;

// Open the database
export const openTodoDB = async () => {
  return openDB<TodoDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create todos store if it doesn't exist
      if (oldVersion < 1) {
        const todoStore = db.createObjectStore("todos", {
          keyPath: "id",
          autoIncrement: true,
        });
        todoStore.createIndex("by-date", "createdAt");
      }

      // Create media store in version 2
      if (oldVersion < 2) {
        const mediaStore = db.createObjectStore("media", {
          keyPath: "id",
          autoIncrement: true,
        });
        mediaStore.createIndex("by-date", "createdAt");
      }
    },
  });
};

// CRUD Operations

// Create a new todo
export const addTodo = async (todo: Omit<Todo, "id">) => {
  const db = await openTodoDB();
  return db.add("todos", todo);
};

// Get all todos
export const getAllTodos = async () => {
  const db = await openTodoDB();
  return db.getAll("todos");
};

// Get a todo by id
export const getTodoById = async (id: number) => {
  const db = await openTodoDB();
  return db.get("todos", id);
};

// Update a todo
export const updateTodo = async (todo: Todo) => {
  const db = await openTodoDB();
  return db.put("todos", todo);
};

// Delete a todo
export const deleteTodo = async (id: number) => {
  const db = await openTodoDB();
  return db.delete("todos", id);
};

// Clear all todos
export const clearTodos = async () => {
  const db = await openTodoDB();
  return db.clear("todos");
};

// Add some dummy data
export const addDummyData = async () => {
  const todos = [
    {
      title: "Learn IndexedDB",
      completed: false,
      createdAt: new Date(),
    },
    {
      title: "Build a Todo App",
      completed: false,
      createdAt: new Date(),
    },
    {
      title: "Master Next.js",
      completed: false,
      createdAt: new Date(),
    },
  ];

  const db = await openTodoDB();
  const tx = db.transaction("todos", "readwrite");

  // Check if data already exists
  const existingCount = await tx.store.count();
  if (existingCount === 0) {
    // Only add dummy data if the store is empty
    for (const todo of todos) {
      await tx.store.add(todo);
    }
  }

  await tx.done;
};

// Media CRUD Operations

// Save media to IndexedDB
export const saveMedia = async (media: Omit<Media, "id">) => {
  const db = await openTodoDB();
  return db.add("media", media);
};

// Get all media
export const getAllMedia = async () => {
  const db = await openTodoDB();
  return db.getAll("media");
};

// Get media by id
export const getMediaById = async (id: number) => {
  const db = await openTodoDB();
  return db.get("media", id);
};

// Delete media
export const deleteMedia = async (id: number) => {
  const db = await openTodoDB();
  return db.delete("media", id);
};

// Clear all media
export const clearMedia = async () => {
  const db = await openTodoDB();
  return db.clear("media");
};

// Update a media record
export const updateMedia = async (media: Media) => {
  const db = await openTodoDB();
  return db.put('media', media);
};
export const deleteMediaBatch = async (ids: number[]) => {
  const db = await openTodoDB();
  const tx = db.transaction('media', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
};