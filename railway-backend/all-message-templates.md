# Accountability System - All Message Templates

## 1. STARTUP NOTIFICATION (Bot Connection)

```
🤖 **Accountability Bot is Online!**

Ready to keep you both accountable! 📊

✅ Morning summaries at 06:00 IST
✅ Evening summaries at 22:00 IST  
✅ Real-time task notifications
✅ Completion celebrations

Focus on your Notion workspace - I'll handle the updates! 💪
```

## 2. MORNING MESSAGE (6:00 AM IST) - Fallback Template

```
🌅 **Good Morning, Accountability Partners!**

Here are today's tasks:

🧑‍💻 **Ilan**
1. [task_name]
2. [task_name]
3. [task_name]

👩‍🎓 **Sidra**
([Name] hasn't added tasks yet.)

Let's make today productive! 💪
```

## 3. EVENING MESSAGE (10:00 PM IST) - Fallback Template

```
🌙 **End of Day Summary**

Hey Ilan and Sidra!

Wrapping up our day, and wanted to check in on progress.

**[Name]**: [completed_count]/[total_count] tasks completed.
Completed tasks:
  ✅ [task_name]
  ✅ [task_name]

[Personalized message based on completion rate]

Let's make tomorrow awesome! ✨

📊 Overall Completion Rate: [overall_completion_rate]%
```

### Evening Personalized Messages:
- **0% completion**: `Alright [Name], no worries at all! Even starting is a victory. Tomorrow is a fresh start! 🌱 Let's tackle those tasks with renewed energy. Remember, you got this!`
- **<50% completion**: `Good start [Name]! Progress is progress, no matter the pace. Tomorrow let's keep building on this momentum! 💪`
- **50-79% completion**: `Great progress [Name]! You're really getting things done. Keep up the excellent work! 🎯`
- **80%+ completion**: `Outstanding work [Name]! You absolutely crushed it today! 🔥 This is the energy we love to see!`

## 4. TASK UPDATE NOTIFICATIONS (Real-time)

### Task Added:
```
➕ **Task Added**

[user_name] added a new task:
📋 "[task_name]"

[contextual_message or fallback: ➕ [user_name] added: **[task_name]**]
```

### Task Completed:
```
✅ **Task Completed**

🎉 [user_name] completed:
📋 "[task_name]"

[contextual_message or fallback: Great job! 🎯]
```

### Task Updated:
```
📝 **Task Updated**

[user_name] updated:
📋 "[task_name]"

[contextual_message]
```

### Default Task Update:
```
🔄 **Task Update**

[contextual_message]
```

## 5. BULK UPDATE NOTIFICATION

```
🔄 **Task Updates**

[formatted_message or fallback below]

📅 Updated: [current_time in IST]
```

### Bulk Update Fallback:
```
🔄 **[user_name] made [change_count] updates:**

➕ [added_count] new tasks
✅ [completed_count] completed
📝 [updated_count] updated

Staying productive! 💪
```

## 6. HEALTH CHECK MESSAGE

```
🔍 **Bot Health Check**

Connection: ✅ Connected / ❌ Disconnected
Group: ✅ Configured / ❌ Not configured
Session: [session_path]
Uptime: [uptime]s

System operational! 🚀
```

## 7. FALLBACK TEMPLATES (When Gemini API fails)

### Simple Task Update Fallbacks:
- **Task Added**: `➕ [user_name] added: **[task_name]**`
- **Task Completed**: `✅ [user_name] completed: **[task_name]**\nGreat job! 🎉`
- **Task Updated**: `📝 [user_name] updated: **[task_name]**`
- **Default**: `🔄 [user_name] made changes to: **[task_name]**`

---

## Notes:
- All messages use WhatsApp formatting with `**text**` for bold
- Line breaks are preserved as `\n`
- Emojis render natively in WhatsApp
- Messages are sent to group: 120363421579500257@g.us
- When Gemini API quota is exceeded, fallback templates are used automatically
