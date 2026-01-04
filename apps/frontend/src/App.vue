<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  location: string;
}

const API_URL = "http://localhost:8787";

// State, nothing extra needed for countdown
import Countdown from './components/Countdown.vue';

// State
const users = ref<User[]>([]);
const form = ref({
  id: "", // For Edit Mode
  firstName: "",
  lastName: "",
  email: "",
  location: "Asia/Jakarta",
  birthDate: "",
});
const loading = ref(false);
const isEditMode = ref(false);

// Actions
const fetchUsers = async () => {
  try {
    const res = await fetch(`${API_URL}/user`);
    const data = await res.json();
    users.value = data as User[];
  } catch (e) {
    console.error(e);
  }
};

const handleSubmit = async () => {
  loading.value = true;
  try {
    const url = isEditMode.value ? `${API_URL}/user/${form.value.id}` : `${API_URL}/user`;
    const method = isEditMode.value ? "PUT" : "POST";

    // Remove ID from body for cleanliness, though API might ignore
    const { id, ...body } = form.value;

    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      alert(isEditMode.value ? "User Updated!" : "User Created!");
      fetchUsers();
      resetForm();
    } else {
      const err = await res.json();
      alert("Error: " + JSON.stringify(err));
    }
  } catch (e) {
    alert("Network Error");
  } finally {
    loading.value = false;
  }
};

const handleEdit = (user: User) => {
  // Backend now returns events relation
  const evt = (user as any).events?.[0];
  const bDate = evt ? evt.date : "";

  form.value = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    location: user.location,
    birthDate: bDate
  };
  isEditMode.value = true;
};

const resetForm = () => {
  const loc = form.value.location;
  form.value = {
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    birthDate: "",
    location: loc
  };
  isEditMode.value = false;
};

const handleDelete = async (id: string) => {
  if (!confirm("Delete?")) return;
  await fetch(`${API_URL}/user/${id}`, { method: "DELETE" });
  fetchUsers();
};

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans p-8">
    <div class="max-w-4xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-gray-800">🎉 Birthday Notification System</h1>
        <p class="text-gray-500">Manage users and schedule greetings.</p>
      </header>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- Form -->
        <div class="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">{{ isEditMode ? 'Edit User' : 'Add User' }}</h2>
            <button v-if="isEditMode" @click="resetForm"
              class="text-xs text-gray-500 hover:text-gray-700 underline">Cancel</button>
          </div>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">First Name</label>
              <input required v-model="form.firstName"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Last Name</label>
              <input required v-model="form.lastName"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Email</label>
              <input required type="email" v-model="form.email"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Birth Date</label>
              <input required type="date" v-model="form.birthDate"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Timezone</label>
              <select v-model="form.location"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                <option value="Asia/Jakarta">Asia/Jakarta</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Australia/Melbourne">Australia/Melbourne</option>
              </select>
            </div>
            <button :disabled="loading" type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
              {{ loading ? "Saving..." : (isEditMode ? "Update User" : "Create User") }}
            </button>
          </form>
        </div>

        <!-- List -->
        <div class="md:col-span-2">
          <h2 class="text-xl font-semibold mb-4">Users ({{ users.length }})</h2>
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <ul class="divide-y divide-gray-100">
              <li v-if="users.length === 0" class="p-6 text-center text-gray-400">No users found.</li>
              <li v-for="user in users" :key="user.id"
                class="p-6 hover:bg-gray-50 flex justify-between items-center transition group">
                <div>
                  <h3 class="text-lg font-medium text-gray-900">{{ user.firstName }} {{ user.lastName }}</h3>
                  <p class="text-sm text-gray-500">{{ user.email }}</p>
                  <div class="mt-2 flex items-center text-xs text-gray-500 gap-2">
                    <span class="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{{ user.location }}</span>
                    <span class="text-indigo-600 font-medium" v-if="(user as any).events?.[0]?.date">
                      🎂
                      <Countdown :birthDate="(user as any).events[0].date" :location="user.location" />
                    </span>
                  </div>
                </div>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click="handleEdit(user)"
                    class="text-indigo-600 hover:text-indigo-900 text-sm font-medium bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition cursor-pointer">
                    Edit
                  </button>
                  <button @click="handleDelete(user.id)"
                    class="text-red-600 hover:text-red-900 text-sm font-medium bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition cursor-pointer">
                    Delete
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
