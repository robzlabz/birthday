<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { toZonedTime } from 'date-fns-tz';
import { differenceInSeconds } from 'date-fns';

const props = defineProps<{
    birthDate: string;
    location: string;
}>();

const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | null = null;

const countdownText = computed(() => {
    try {
        const parts = props.birthDate.split('-').map(Number);
        if (parts.length < 3) return "Invalid Date";
        const bYear = parts[0];
        const bMonth = parts[1];
        const bDay = parts[2];

        if (!bMonth || !bDay) return "Invalid Date";

        const currentTime = now.value;
        // Current time in User's Timezone
        const userNow = toZonedTime(currentTime, props.location);

        // Target this year
        let targetYear = userNow.getFullYear();
        // bMonth is 1-indexed, Date needs 0-indexed
        let targetDate = new Date(targetYear, bMonth - 1, bDay, 9, 0, 0);

        // Handle Leap Year Logic if needed (JS handles Feb 29 -> Mar 1 automatically for non-leap years)

        // If target has passed, move to next year
        if (targetDate <= userNow) {
            targetYear++;
            targetDate = new Date(targetYear, bMonth - 1, bDay, 9, 0, 0);
        }

        // Calc difference
        const diff = differenceInSeconds(targetDate, userNow);

        const days = Math.floor(diff / (3600 * 24));
        const hours = Math.floor((diff % (3600 * 24)) / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } catch (e) {
        return "Invalid Timezone";
    }
});

onMounted(() => {
    timer = setInterval(() => {
        now.value = new Date();
    }, 1000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<template>
    <span>{{ countdownText }}</span>
</template>
