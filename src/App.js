import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Calendar, Repeat, Trash2, Edit2, Check, Save, 
  X, ChevronDown, ChevronUp, GripVertical, CheckCircle2, 
  Clock, TrendingUp, ListTodo, AlertCircle, Layout, 
  PieChart, Tag, ArrowRight, MoreHorizontal, Sun, Moon
} from 'lucide-react';
import { 
  format, addDays, addWeeks, addMonths, addYears, 
  isAfter, isSameDay, parseISO, startOfDay, isBefore 
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

// --- UTILITY FUNCTIONS (Recurrence Logic) ---

const getDaySuffix = (day) => {
  if (!day) return '';
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const getRecurrenceDisplayText = (task) => {
  if (!task.recurrence) return '';
  
  const pattern = task.recurrencePattern || {};
  let text = '';
  
  switch (task.recurrence) {
    case 'daily':
      text = pattern.interval === 1 ? 'Daily' : `Every ${pattern.interval} days`;
      break;
    
    case 'weekly':
      if (pattern.daysOfWeek?.length > 0) {
        const days = pattern.daysOfWeek.map(d => d.substring(0, 3)).join(', ');
        text = pattern.interval === 1 
          ? `Weekly on ${days}` 
          : `Every ${pattern.interval} weeks on ${days}`;
      } else {
        text = pattern.interval === 1 ? 'Weekly' : `Every ${pattern.interval} weeks`;
      }
      break;
    
    case 'monthly':
      if (pattern.dayOfMonth) {
        const suffix = getDaySuffix(pattern.dayOfMonth);
        text = pattern.interval === 1
          ? `Monthly on the ${pattern.dayOfMonth}${suffix}`
          : `Every ${pattern.interval} months on the ${pattern.dayOfMonth}${suffix}`;
      } else {
        text = pattern.interval === 1 ? 'Monthly' : `Every ${pattern.interval} months`;
      }
      break;
    
    case 'yearly':
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = months[pattern.monthOfYear || 0];
      if (pattern.dayOfMonth) {
        const suffix = getDaySuffix(pattern.dayOfMonth);
        text = pattern.interval === 1
          ? `Yearly on ${monthName} ${pattern.dayOfMonth}${suffix}`
          : `Every ${pattern.interval} years on ${monthName} ${pattern.dayOfMonth}${suffix}`;
      } else {
        text = pattern.interval === 1 ? 'Yearly' : `Every ${pattern.interval} years`;
      }
      break;
    
    default:
      text = task.recurrence;
  }
  
  if (pattern.endDate) {
    text += ` until ${new Date(pattern.endDate).toLocaleDateString()}`;
  }
  
  return text;
};

const calculateNextOccurrence = (task) => {
  if (!task.recurrence || !task.recurrencePattern) return null;
  
  const currentDate = parseISO(task.dueDate);
  const now = new Date();
  
  if (task.recurrencePattern.endDate) {
    const endDate = parseISO(task.recurrencePattern.endDate);
    if (isAfter(now, endDate)) return null;
  }

  let nextDate = currentDate;
  
  // Safety break to prevent infinite loops in bad data
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while ((isAfter(now, nextDate) || isSameDay(nextDate, currentDate)) && iterations < MAX_ITERATIONS) {
    nextDate = addInterval(nextDate, task);
    
    if (task.recurrencePattern.endDate) {
      const endDate = parseISO(task.recurrencePattern.endDate);
      if (isAfter(nextDate, endDate)) return null;
    }
    iterations++;
  }

  return nextDate.toISOString().split('T')[0];
};

const addInterval = (date, task) => {
  const pattern = task.recurrencePattern;
  
  switch (task.recurrence) {
    case 'daily':
      return addDays(date, pattern.interval || 1);
    
    case 'weekly':
      let nextDate = addWeeks(date, pattern.interval || 1);
      if (pattern.daysOfWeek?.length > 0) {
        // Find next valid day
        let daysChecked = 0;
        while (!pattern.daysOfWeek.includes(
          nextDate.toLocaleDateString('en-US', { weekday: 'long' })
        ) && daysChecked < 7) {
          nextDate = addDays(nextDate, 1);
          daysChecked++;
        }
      }
      return nextDate;
    
    case 'monthly':
      nextDate = addMonths(date, pattern.interval || 1);
      if (pattern.dayOfMonth) {
        const daysInMonth = new Date(
          nextDate.getFullYear(), 
          nextDate.getMonth() + 1, 
          0
        ).getDate();
        const day = Math.min(pattern.dayOfMonth, daysInMonth);
        nextDate.setDate(day);
      }
      return nextDate;
    
    case 'yearly':
      nextDate = addYears(date, pattern.interval || 1);
      if (pattern.monthOfYear !== null) {
        nextDate.setMonth(pattern.monthOfYear);
      }
      if (pattern.dayOfMonth) {
        const daysInMonth = new Date(
          nextDate.getFullYear(), 
          nextDate.getMonth() + 1, 
          0
        ).getDate();
        const day = Math.min(pattern.dayOfMonth, daysInMonth);
        nextDate.setDate(day);
      }
      return nextDate;
    
    default:
      return date;
  }
};

// --- DATA & CONSTANTS ---

const SAMPLE_TASKS = [
  {
    id: 1,
    title: 'Morning Standup',
    description: 'Daily team sync-up meeting',
    priority: 'medium',
    category: 'meeting',
    dueDate: new Date().toISOString().split('T')[0],
    completed: false,
    recurrence: 'daily',
    recurrencePattern: { interval: 1, daysOfWeek: [], dayOfMonth: null, monthOfYear: null, endDate: null },
    createdAt: new Date().toISOString(),
    checklist: [{ id: 1, text: 'Prepare update', checked: true }, { id: 2, text: 'Review blockers', checked: false }]
  },
  {
    id: 2,
    title: 'Weekly Report',
    description: 'Compile metrics',
    priority: 'high',
    category: 'work',
    dueDate: addDays(new Date(), 2).toISOString().split('T')[0],
    completed: false,
    recurrence: 'weekly',
    recurrencePattern: { interval: 1, daysOfWeek: ['Friday'], endDate: null },
    createdAt: new Date().toISOString(),
    checklist: []
  }
];

const CATEGORY_COLORS = {
  work: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  personal: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  meeting: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  learning: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  health: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
};

const PRIORITY_COLORS = {
  high: 'text-red-600 bg-red-50 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/50',
  medium: 'text-orange-600 bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/50',
  low: 'text-green-600 bg-green-50 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/50'
};

// --- COMPONENTS ---

const Checklist = ({ checklist, onUpdate, isEditingMode = false }) => {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const addItem = () => {
    if (!newItem.trim()) return;
    onUpdate([...checklist, { id: uuidv4(), text: newItem, checked: false }]);
    setNewItem('');
  };

  const toggleItem = (id) => {
    onUpdate(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const deleteItem = (id) => {
    onUpdate(checklist.filter(item => item.id !== id));
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const saveEditing = (id) => {
    onUpdate(checklist.map(item => item.id === id ? { ...item, text: editingText } : item));
    setEditingId(null);
  };

  return (
    <div className={`mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 ${isEditingMode ? 'bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg' : ''}`}>
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
        <ListTodo size={16} />
        <span>Subtasks ({checklist.filter(i => i.checked).length}/{checklist.length})</span>
      </div>
      
      <div className="space-y-2 mb-3">
        {checklist.map(item => (
          <div key={item.id} className="group flex items-start gap-3 text-sm">
            <button
              onClick={() => toggleItem(item.id)}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                item.checked 
                  ? 'bg-indigo-500 border-indigo-500 text-white' 
                  : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-400'
              }`}
            >
              {item.checked && <Check size={10} strokeWidth={4} />}
            </button>
            
            {editingId === item.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditing(item.id)}
                  onBlur={() => saveEditing(item.id)}
                  className="flex-1 text-sm bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded px-2 py-0.5"
                />
              </div>
            ) : (
              <span 
                onClick={() => startEditing(item)}
                className={`flex-1 transition-all cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 ${
                  item.checked ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {item.text}
              </span>
            )}
            
            <button 
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-0.5"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add a subtask..."
          className="flex-1 text-sm bg-slate-50 dark:bg-slate-800 border-0 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-700 transition-all placeholder:text-slate-400 dark:text-slate-200"
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button 
          onClick={addItem}
          disabled={!newItem.trim()}
          className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

const RecurrenceSettings = ({ recurrence, pattern, onChangeRecurrence, onChangePattern }) => {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mt-4 space-y-4">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
        <Repeat size={16} /> Recurrence Rules
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Frequency</label>
          <select 
            value={recurrence} 
            onChange={(e) => onChangeRecurrence(e.target.value)}
            className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {recurrence !== 'none' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Interval</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={pattern.interval || 1}
                onChange={(e) => onChangePattern({ ...pattern, interval: parseInt(e.target.value) || 1 })}
                className="w-20 text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {recurrence === 'daily' ? 'day(s)' : recurrence === 'weekly' ? 'week(s)' : recurrence === 'monthly' ? 'month(s)' : 'year(s)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {recurrence === 'weekly' && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Repeat On</label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => {
                  const currentDays = pattern.daysOfWeek || [];
                  const newDays = currentDays.includes(day)
                    ? currentDays.filter(d => d !== day)
                    : [...currentDays, day];
                  onChangePattern({ ...pattern, daysOfWeek: newDays });
                }}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  pattern.daysOfWeek?.includes(day)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-300'
                }`}
              >
                {day.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {recurrence !== 'none' && (
        <div>
           <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date (Optional)</label>
           <input 
            type="date"
            value={pattern.endDate || ''}
            onChange={(e) => onChangePattern({...pattern, endDate: e.target.value || null})}
            className="text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
           />
        </div>
      )}
    </div>
  );
};

const TaskItem = ({ task, onUpdate, onDelete, onCompleteRecurring }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync editedTask if prop changes externally
  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleComplete = (e) => {
    e.stopPropagation();
    if (task.recurrence) {
      onCompleteRecurring(task.id);
    } else {
      onUpdate(task.id, { ...task, completed: !task.completed });
    }
  };

  const handleSave = () => {
    onUpdate(task.id, editedTask);
    setIsEditing(false);
  };

  const isOverdue = !task.completed && isBefore(parseISO(task.dueDate), startOfDay(new Date()));
  const isDueToday = !task.completed && isSameDay(parseISO(task.dueDate), new Date());

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900 p-6 mb-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-white">Edit Task</h3>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <input
            type="text"
            value={editedTask.title}
            onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
            className="w-full text-lg font-medium border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 border p-2"
            placeholder="Task title"
          />
          
          <textarea
            value={editedTask.description}
            onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
            className="w-full text-sm text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 dark:bg-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 border p-2 min-h-[80px]"
            placeholder="Description..."
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Priority</label>
              <select 
                value={editedTask.priority}
                onChange={(e) => setEditedTask({...editedTask, priority: e.target.value})}
                className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
              <select 
                value={editedTask.category}
                onChange={(e) => setEditedTask({...editedTask, category: e.target.value})}
                className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
              >
                <option value="work">Work</option>
                <option value="personal">Personal</option>
                <option value="meeting">Meeting</option>
                <option value="learning">Learning</option>
                <option value="health">Health</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
             <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={editedTask.dueDate}
                onChange={(e) => setEditedTask({...editedTask, dueDate: e.target.value})}
                className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-md"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
            <Checklist 
               checklist={editedTask.checklist || []}
               onUpdate={(updatedList) => setEditedTask({...editedTask, checklist: updatedList})}
               isEditingMode={true}
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-indigo-600 dark:text-indigo-400 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              <Repeat size={14} /> {isExpanded ? 'Hide' : 'Edit'} Recurrence Rules
            </button>
            
            {isExpanded && (
              <RecurrenceSettings
                recurrence={editedTask.recurrence || 'none'}
                pattern={editedTask.recurrencePattern || { interval: 1, daysOfWeek: [] }}
                onChangeRecurrence={(val) => setEditedTask({...editedTask, recurrence: val, recurrencePattern: val === 'none' ? null : (editedTask.recurrencePattern || { interval: 1, daysOfWeek: [] }) })}
                onChangePattern={(val) => setEditedTask({...editedTask, recurrencePattern: val})}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`group relative bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200 mb-3
        ${task.completed ? 'opacity-75 border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50' : 'hover:shadow-md border-slate-200 dark:border-slate-700 shadow-sm'}
        ${isOverdue ? 'border-l-4 border-l-red-500' : isDueToday ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-transparent hover:border-l-indigo-500'}
      `}
    >
      <div className="p-4 flex gap-4 items-start cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        {/* Checkbox / Complete Button */}
        <button 
          onClick={handleComplete}
          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200
            ${task.completed 
              ? 'bg-emerald-500 border-emerald-500 text-white' 
              : task.recurrence 
                ? 'border-indigo-300 dark:border-indigo-600 text-transparent hover:border-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400' 
                : 'border-slate-300 dark:border-slate-500 text-transparent hover:border-emerald-500 hover:text-emerald-500'
            }
          `}
        >
          {task.completed ? <Check size={14} strokeWidth={4} /> : task.recurrence ? <Repeat size={12} /> : <Check size={14} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h4 className={`font-medium text-slate-800 dark:text-slate-100 truncate pr-8 ${task.completed ? 'line-through text-slate-500 dark:text-slate-500' : ''}`}>
              {task.title}
            </h4>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg p-1">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {task.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Metadata Badges */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${CATEGORY_COLORS[task.category]}`}>
              {task.category}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </span>
            
            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${isOverdue ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}>
              <Calendar size={12} />
              {format(parseISO(task.dueDate), 'MMM d')}
            </div>

            {task.recurrence && (
              <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                <Repeat size={12} />
                {task.recurrence}
              </div>
            )}
            
            {task.checklist && task.checklist.length > 0 && (
               <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700 ml-auto">
                <ListTodo size={12} />
                {task.checklist.filter(i => i.checked).length}/{task.checklist.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details (Checklist & Recurrence Info) */}
      {isExpanded && !isEditing && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
           {task.recurrence && (
             <div className="mb-3 text-xs text-indigo-600 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100/50 dark:border-indigo-900/30 flex items-start gap-2">
               <Repeat size={14} className="mt-0.5" />
               <span>
                 <strong>Recurring Rule:</strong> {getRecurrenceDisplayText(task)}
               </span>
             </div>
           )}
           <Checklist 
             checklist={task.checklist || []} 
             onUpdate={(newChecklist) => onUpdate(task.id, { ...task, checklist: newChecklist })}
           />
        </div>
      )}
    </div>
  );
};

const AddTaskModal = ({ isOpen, onClose, onAdd }) => {
  const [task, setTask] = useState({
    title: '', description: '', priority: 'medium', category: 'work',
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'none',
    recurrencePattern: { interval: 1, daysOfWeek: [], endDate: null },
    checklist: []
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      ...task,
      recurrence: task.recurrence === 'none' ? null : task.recurrence,
      recurrencePattern: task.recurrence === 'none' ? null : task.recurrencePattern,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    // Reset
    setTask({
      title: '', description: '', priority: 'medium', category: 'work',
      dueDate: new Date().toISOString().split('T')[0],
      recurrence: 'none',
      recurrencePattern: { interval: 1, daysOfWeek: [], endDate: null },
      checklist: []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> New Task
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">What needs to be done?</label>
              <input
                autoFocus
                type="text"
                placeholder="e.g., Review Q3 Marketing Report"
                className="w-full text-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-300 dark:placeholder:text-slate-500"
                value={task.title}
                onChange={e => setTask({...task, title: e.target.value})}
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                placeholder="Add details, context, or links..."
                className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                value={task.description}
                onChange={e => setTask({...task, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                <select 
                  className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500"
                  value={task.category}
                  onChange={e => setTask({...task, category: e.target.value})}
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                  <option value="meeting">Meeting</option>
                  <option value="learning">Learning</option>
                  <option value="health">Health</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Priority</label>
                <select 
                  className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500"
                  value={task.priority}
                  onChange={e => setTask({...task, priority: e.target.value})}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Due Date</label>
                <input
                  type="date"
                  className="w-full text-sm border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-indigo-500"
                  value={task.dueDate}
                  onChange={e => setTask({...task, dueDate: e.target.value})}
                />
              </div>
              <div>
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Recurrence</label>
                 <button 
                  type="button"
                  onClick={() => setTask({...task, recurrence: task.recurrence === 'none' ? 'weekly' : 'none'})}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg transition-colors ${task.recurrence !== 'none' ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}
                 >
                   <span>{task.recurrence !== 'none' ? 'Enabled' : 'None'}</span>
                   <Repeat size={16} />
                 </button>
              </div>
            </div>

            {task.recurrence !== 'none' && (
              <RecurrenceSettings 
                recurrence={task.recurrence}
                pattern={task.recurrencePattern}
                onChangeRecurrence={(val) => setTask({...task, recurrence: val})}
                onChangePattern={(val) => setTask({...task, recurrencePattern: val})}
              />
            )}

            <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Checklist</label>
                <Checklist 
                    checklist={task.checklist}
                    onUpdate={(updatedList) => setTask({...task, checklist: updatedList})}
                    isEditingMode={true}
                />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : SAMPLE_TASKS;
  });
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const addTask = (task) => setTasks([...tasks, { ...task, id: Date.now() }]);
  
  const updateTask = (id, updated) => {
    setTasks(tasks.map(t => t.id === id ? updated : t));
  };
  
  const deleteTask = (id) => setTasks(tasks.filter(t => t.id !== id));

  const handleCompleteRecurring = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const nextDate = calculateNextOccurrence(task);
    
    // Complete current
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, completed: true } : t);

    // Create next if valid
    if (nextDate) {
      const newTask = {
        ...task,
        id: Date.now(),
        dueDate: nextDate,
        completed: false,
        checklist: task.checklist.map(i => ({ ...i, id: uuidv4(), checked: false })),
        createdAt: new Date().toISOString()
      };
      setTasks([...updatedTasks, newTask]);
    } else {
      setTasks(updatedTasks);
    }
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const now = new Date();
    
    switch(filter) {
      case 'active': result = tasks.filter(t => !t.completed); break;
      case 'completed': result = tasks.filter(t => t.completed); break;
      case 'overdue': result = tasks.filter(t => !t.completed && isBefore(parseISO(t.dueDate), startOfDay(now))); break;
      case 'today': result = tasks.filter(t => !t.completed && isSameDay(parseISO(t.dueDate), now)); break;
      case 'recurring': result = tasks.filter(t => t.recurrence); break;
      default: break;
    }
    
    // Sort: Overdue first, then by date, then priority
    return result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [tasks, filter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const overdue = tasks.filter(t => !t.completed && isBefore(parseISO(t.dueDate), startOfDay(new Date()))).length;
    const dueToday = tasks.filter(t => !t.completed && isSameDay(parseISO(t.dueDate), new Date())).length;
    return { total, completed, overdue, dueToday };
  }, [tasks]);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <div className="flex min-h-screen font-sans text-slate-900 dark:text-slate-100 selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100">
        
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-30 px-4 py-3 flex justify-between items-center transition-colors duration-200">
           <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
             <Layout size={24} />
             <span>TaskFlow</span>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 dark:text-slate-400">
               <MoreHorizontal />
             </button>
           </div>
        </div>
  
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2 font-bold text-2xl text-indigo-600 dark:text-indigo-400">
                <Layout className="fill-indigo-600 dark:fill-indigo-400" />
                <span>TaskFlow</span>
              </div>
              <button 
                onClick={toggleTheme} 
                className="hidden md:block p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
  
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white py-3 px-4 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95 font-medium mb-8"
            >
              <Plus size={20} /> New Task
            </button>
  
            <nav className="space-y-1">
              {[
                { id: 'all', label: 'All Tasks', icon: Layout, count: stats.total },
                { id: 'today', label: 'Due Today', icon: Clock, count: stats.dueToday, highlight: true },
                { id: 'active', label: 'Active', icon: ListTodo, count: stats.total - stats.completed },
                { id: 'overdue', label: 'Overdue', icon: AlertCircle, count: stats.overdue, alert: true },
                { id: 'recurring', label: 'Recurring', icon: Repeat, count: tasks.filter(t => t.recurrence).length },
                { id: 'completed', label: 'Completed', icon: CheckCircle2, count: stats.completed },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    filter === item.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={
                      item.alert && item.count > 0 ? 'text-red-500 dark:text-red-400' : 
                      item.highlight && item.count > 0 ? 'text-amber-500 dark:text-amber-400' : ''
                    } />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.alert ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                      item.highlight ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 
                      filter === item.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
  
          <div className="mt-auto p-6 border-t border-slate-100 dark:border-slate-700">
             <h4 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Daily Snapshot</h4>
             <div className="space-y-4">
               <div>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-slate-600 dark:text-slate-400">Due Today</span>
                   <span className="font-bold text-slate-900 dark:text-slate-200">{stats.dueToday}</span>
                 </div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                   <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min((stats.dueToday / (stats.total || 1)) * 100, 100)}%` }}></div>
                 </div>
               </div>
               <div>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-slate-600 dark:text-slate-400">Completion</span>
                   <span className="font-bold text-slate-900 dark:text-slate-200">{Math.round((stats.completed / (stats.total || 1)) * 100)}%</span>
                 </div>
                 <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                   <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}></div>
                 </div>
               </div>
             </div>
          </div>
        </aside>
  
        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden pt-16 md:pt-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
          <header className="flex-shrink-0 px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-end transition-colors duration-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {filter === 'all' ? 'All Tasks' : 
                 filter === 'active' ? 'Active Tasks' :
                 filter === 'today' ? "Today's Tasks" :
                 filter.charAt(0).toUpperCase() + filter.slice(1)}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 text-sm">
                <Calendar size={14} />
                {format(new Date(), 'EEEE, MMMM do, yyyy')}
              </p>
            </div>
            <div className="flex gap-2">
              {/* Sort/View Options could go here */}
            </div>
          </header>
  
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto">
              {stats.overdue > 0 && filter !== 'completed' && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="text-red-500 dark:text-red-400 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-semibold text-red-700 dark:text-red-400">You have {stats.overdue} overdue task{stats.overdue > 1 ? 's' : ''}</h4>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">Check your list and reschedule if necessary.</p>
                  </div>
                </div>
              )}
  
              {filteredTasks.length === 0 ? (
                <div className="text-center py-20 opacity-60">
                  <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ListTodo size={40} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No tasks found</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    {filter === 'today' ? "You have no tasks due today." : "You're all caught up or haven't added any tasks yet."}
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-6 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  >
                    Create a new task
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTasks.map(task => (
                    <TaskItem 
                      key={task.id}
                      task={task}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onCompleteRecurring={handleCompleteRecurring}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
  
        <AddTaskModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onAdd={addTask} 
        />
  
        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default App;