import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Calendar, Repeat, Trash2, Edit2, Check, Save, 
  X, ChevronDown, ChevronUp, GripVertical, CheckCircle2, 
  Clock, TrendingUp, ListTodo, AlertCircle, Layout, 
  PieChart, Tag, ArrowRight, MoreHorizontal, Sun, Moon,
  Filter, Bell, Menu, Database, Eye, EyeOff, Tag as TagIcon,
  Search, RefreshCw, User, Settings, Download
} from 'lucide-react';
import { 
  format, addDays, addWeeks, addMonths, addYears, 
  isAfter, isSameDay, parseISO, startOfDay, isBefore, isToday,
  isTomorrow, isYesterday, differenceInDays, getDay
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

const getSmartDateBadge = (dateString) => {
  const date = parseISO(dateString);
  const today = new Date();
  
  if (isToday(date)) return { text: 'Today', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300' };
  if (isTomorrow(date)) return { text: 'Tomorrow', color: 'bg-blue-500', textColor: 'text-blue-700 dark:text-blue-300' };
  if (isYesterday(date)) return { text: 'Yesterday', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' };
  
  const diffDays = differenceInDays(date, today);
  if (diffDays >= -7 && diffDays <= 7) {
    return { 
      text: format(date, 'EEE'), 
      color: 'bg-slate-200 dark:bg-slate-700', 
      textColor: 'text-slate-700 dark:text-slate-300' 
    };
  }
  
  return { 
    text: format(date, 'MMM d'), 
    color: 'bg-slate-100 dark:bg-slate-800', 
    textColor: 'text-slate-600 dark:text-slate-400' 
  };
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

const calculateNextOccurrence = (task, completedDate) => {
  if (!task.recurrence || !task.recurrencePattern) return null;
  
  const referenceDate = completedDate || new Date();
  const currentDate = parseISO(task.dueDate);
  const now = new Date();
  
  if (task.recurrencePattern.endDate) {
    const endDate = parseISO(task.recurrencePattern.endDate);
    if (isAfter(now, endDate)) return null;
  }

  let nextDate = currentDate;
  
  if (isAfter(now, currentDate) || isSameDay(now, currentDate)) {
    nextDate = now;
  }

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

  if (isAfter(nextDate, now) || isSameDay(nextDate, addDays(now, 1))) {
    return nextDate.toISOString().split('T')[0];
  }
  
  return null;
};

const addInterval = (date, task) => {
  const pattern = task.recurrencePattern;
  
  switch (task.recurrence) {
    case 'daily':
      return addDays(date, pattern.interval || 1);
    
    case 'weekly':
      let nextDate = addWeeks(date, pattern.interval || 1);
      if (pattern.daysOfWeek?.length > 0) {
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

// Removed sample tasks - now app starts empty
const SAMPLE_TASKS = [];

// Dynamic categories - user can add custom ones
const DEFAULT_CATEGORIES = {
  work: 'bg-blue-50/80 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-500/30',
  personal: 'bg-purple-50/80 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-300 dark:ring-purple-500/30',
  meeting: 'bg-amber-50/80 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-500/30',
  learning: 'bg-cyan-50/80 text-cyan-700 ring-1 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-300 dark:ring-cyan-500/30',
  health: 'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30'
};

const PRIORITY_COLORS = {
  high: 'text-rose-600 bg-rose-50 ring-1 ring-rose-500/20 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-500/30',
  medium: 'text-orange-600 bg-orange-50 ring-1 ring-orange-500/20 dark:bg-orange-900/20 dark:text-orange-300 dark:ring-orange-500/30',
  low: 'text-teal-600 bg-teal-50 ring-1 ring-teal-500/20 dark:bg-teal-900/20 dark:text-teal-300 dark:ring-teal-500/30'
};

// --- MODAL COMPONENTS ---

const SettingsModal = ({ isOpen, onClose, onClearData, darkMode }) => {
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  const handleClearData = () => {
    if (confirmClear) {
      localStorage.removeItem('tasks');
      localStorage.removeItem('theme');
      localStorage.removeItem('customCategories');
      window.location.reload();
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <Settings size={20} className="text-indigo-500" />
            Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Data Management</h3>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Database size={20} className="text-rose-500" />
                  <div>
                    <h4 className="font-medium text-slate-800 dark:text-slate-200">Clear All Data</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Remove all tasks and reset to defaults</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleClearData}
                className={`w-full mt-4 py-3 rounded-xl font-medium transition-all ${
                  confirmClear 
                    ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'
                }`}
              >
                {confirmClear ? 'Click Again to Confirm' : 'Clear All Data'}
              </button>
              
              {confirmClear && (
                <p className="mt-2 text-sm text-rose-600 dark:text-rose-400 text-center">
                  Warning: This action cannot be undone!
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">App Info</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Version</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">1.2.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Theme</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {darkMode ? 'Dark' : 'Light'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Tasks Count</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {JSON.parse(localStorage.getItem('tasks') || '[]').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const FilterModal = ({ isOpen, onClose, currentFilter, onFilterChange, categories, priorities, darkMode }) => {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [dateRange, setDateRange] = useState('all');

  if (!isOpen) return null;

  const handleApply = () => {
    onFilterChange({
      categories: selectedCategories,
      priorities: selectedPriorities,
      showCompleted,
      dateRange
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedCategories([]);
    setSelectedPriorities([]);
    setShowCompleted(true);
    setDateRange('all');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <Filter size={20} className="text-indigo-500" />
            Advanced Filters
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Date Range</h3>
            <div className="grid grid-cols-2 gap-2">
              {['all', 'today', 'week', 'month', 'overdue'].map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`py-2.5 text-sm font-medium rounded-lg border transition-all ${
                    dateRange === range
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  {range === 'all' ? 'All Dates' : 
                   range === 'today' ? 'Today' : 
                   range === 'week' ? 'This Week' : 
                   range === 'month' ? 'This Month' : 
                   'Overdue'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {Object.keys(categories).map(category => (
                <button
                  key={category}
                  onClick={() => {
                    if (selectedCategories.includes(category)) {
                      setSelectedCategories(selectedCategories.filter(c => c !== category));
                    } else {
                      setSelectedCategories([...selectedCategories, category]);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                    selectedCategories.includes(category)
                      ? `${categories[category].split(' ')[0]} text-white border-current`
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-3">Priorities</h3>
            <div className="flex flex-wrap gap-2">
              {['high', 'medium', 'low'].map(priority => (
                <button
                  key={priority}
                  onClick={() => {
                    if (selectedPriorities.includes(priority)) {
                      setSelectedPriorities(selectedPriorities.filter(p => p !== priority));
                    } else {
                      setSelectedPriorities([...selectedPriorities, priority]);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                    selectedPriorities.includes(priority)
                      ? `${priorities[priority].split(' ')[0]} text-white border-current`
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`p-1 rounded ${showCompleted ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
                {showCompleted ? <Eye size={16} className="text-emerald-600 dark:text-emerald-400" /> : <EyeOff size={16} className="text-slate-400" />}
              </div>
              <div>
                <h4 className="font-medium text-slate-800 dark:text-slate-200">Show Completed</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">Display completed tasks</p>
              </div>
            </div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showCompleted ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showCompleted ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-between flex-shrink-0">
          <button 
            onClick={handleReset}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={handleApply}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30 transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

const NotificationsModal = ({ isOpen, onClose, tasks, darkMode }) => {
  const notifications = useMemo(() => {
    const now = new Date();
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    return tasks
      .filter(task => !task.completed)
      .map(task => {
        const dueDate = parseISO(task.dueDate);
        let type = 'info';
        let time = '';
        
        if (isBefore(dueDate, startOfDay(now))) {
          type = 'overdue';
          time = 'Overdue';
        } else if (isSameDay(dueDate, now)) {
          type = 'today';
          time = 'Due today';
        } else if (isSameDay(dueDate, tomorrow)) {
          type = 'tomorrow';
          time = 'Due tomorrow';
        }
        
        return { ...task, type, time };
      })
      .filter(n => n.type !== 'info')
      .sort((a, b) => {
        if (a.type === 'overdue' && b.type !== 'overdue') return -1;
        if (a.type !== 'overdue' && b.type === 'overdue') return 1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
  }, [tasks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <Bell size={20} className="text-indigo-500" />
            Notifications
            {notifications.length > 0 && (
              <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">
                {notifications.length}
              </span>
            )}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">All caught up!</h3>
              <p className="text-slate-500 dark:text-slate-400">No pending notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-xl border transition-all ${
                    notification.type === 'overdue'
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50'
                      : notification.type === 'today'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50'
                      : 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {notification.title}
                    </h4>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      notification.type === 'overdue'
                        ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                        : notification.type === 'today'
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    }`}>
                      {notification.time}
                    </span>
                  </div>
                  
                  {notification.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                      {notification.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded ${DEFAULT_CATEGORIES[notification.category] || DEFAULT_CATEGORIES.work}`}>
                        {notification.category}
                      </span>
                      <span className={`px-2 py-1 rounded ${PRIORITY_COLORS[notification.priority]}`}>
                        {notification.priority}
                      </span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">
                      {format(parseISO(notification.dueDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const InstallPromptModal = ({ isOpen, onClose, onInstall }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Plus size={20} />
            </div>
            Install CarryOut
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-xl">
              <Layout size={32} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">Get the full CarryOut experience</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Install as app for offline access and notifications</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">Offline Access</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Use without internet connection</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
                <Bell size={18} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">Push Notifications</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Get reminders for due tasks</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded">
                <TrendingUp size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-800 dark:text-slate-200">Fast Loading</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Launch instantly from home screen</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Not Now
          </button>
          <button 
            onClick={onInstall}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/50 transition-all"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTS ---

const Checklist = ({ checklist, onUpdate, isEditingMode = false, showProgressBar = false }) => {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const progress = checklist.length > 0 
    ? Math.round((checklist.filter(i => i.checked).length / checklist.length) * 100) 
    : 0;

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
    <div className={`mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 ${isEditingMode ? 'bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-xl' : ''}`}>
      {showProgressBar && checklist.length > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs font-medium mb-1.5">
            <span className="text-slate-500 dark:text-slate-400">Progress</span>
            <span className="text-slate-900 dark:text-slate-200">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-indigo-500 h-2 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <ListTodo size={14} />
        <span>Subtasks • {progress}% Complete</span>
      </div>
      
      <div className="space-y-3 mb-4">
        {checklist.map(item => (
          <div key={item.id} className="group flex items-start gap-3 text-sm">
            <button
              onClick={() => toggleItem(item.id)}
              className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all duration-200 ${
                item.checked 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm scale-100' 
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-400 text-transparent'
              }`}
            >
              <Check size={12} strokeWidth={3} />
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
                  className="flex-1 text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md px-3 py-1 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            ) : (
              <span 
                onClick={() => startEditing(item)}
                className={`flex-1 transition-all cursor-pointer select-none ${
                  item.checked 
                    ? 'text-slate-400 dark:text-slate-600 line-through decoration-slate-300' 
                    : 'text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                {item.text}
              </span>
            )}
            
            <button 
              onClick={() => deleteItem(item.id)}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-all"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2 group focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-lg">
        <div className="relative flex-1">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a subtask..."
            className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all placeholder:text-slate-400 dark:text-slate-200"
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
             <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hidden md:inline-block">↵</span>
             <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded md:hidden">Add</span>
          </div>
        </div>
        <button 
          onClick={addItem}
          disabled={!newItem.trim()}
          className="p-2.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

const RecurrenceSettings = ({ recurrence, pattern, onChangeRecurrence, onChangePattern, dueDate, onDueDateChange }) => {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Get day name from date
  const getDayNameFromDate = (dateString) => {
    const date = parseISO(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Auto-detect and replace the day from due date when dueDate changes
  useEffect(() => {
    if (recurrence === 'weekly' && dueDate) {
      const dayName = getDayNameFromDate(dueDate);
      const currentDays = pattern.daysOfWeek || [];
      
      // Always replace selected days with the due date's day
      // If interval allows multiple days, keep the due date day as first
      const interval = pattern.interval || 1;
      if (interval === 1) {
        // Single day: replace with due date day
        if (!currentDays.includes(dayName) || currentDays.length !== 1) {
          onChangePattern({ ...pattern, daysOfWeek: [dayName] });
        }
      } else {
        // Multiple days allowed: ensure due date day is included
        if (!currentDays.includes(dayName)) {
          // Add due date day and keep other days if within limit
          const newDays = [dayName, ...currentDays.slice(0, interval - 1)];
          onChangePattern({ ...pattern, daysOfWeek: newDays });
        }
      }
    }
  }, [dueDate, recurrence]);

  // Handle day selection with validation
  const handleDayToggle = (day) => {
    const currentDays = pattern.daysOfWeek || [];
    const interval = pattern.interval || 1;
    
    // Validation: Can't select more days than interval
    if (!currentDays.includes(day) && currentDays.length >= interval) {
      return; // Don't allow selection if already at limit
    }
    
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    onChangePattern({ ...pattern, daysOfWeek: newDays });
    
    // If the due date's day was deselected, update due date to first selected day
    const dueDateDay = dueDate ? getDayNameFromDate(dueDate) : null;
    if (dueDateDay && !newDays.includes(dueDateDay) && newDays.length > 0) {
      // Find next occurrence of first selected day
      const nextDate = calculateNextDateForDay(newDays[0]);
      if (nextDate && onDueDateChange) {
        onDueDateChange(nextDate);
      }
    }
  };

  // Calculate next date for a specific day
  const calculateNextDateForDay = (dayName) => {
    const today = new Date();
    const daysMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    
    const targetDay = daysMap[dayName];
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    const nextDate = addDays(today, daysToAdd);
    return nextDate.toISOString().split('T')[0];
  };

  // Handle interval change with validation
  const handleIntervalChange = (newInterval) => {
    const currentDays = pattern.daysOfWeek || [];
    const validatedInterval = Math.max(1, newInterval);
    
    // If we're reducing interval, we need to limit selected days
    let validatedDays = [...currentDays];
    if (validatedDays.length > validatedInterval) {
      // Keep only first N days based on new interval
      validatedDays = validatedDays.slice(0, validatedInterval);
      
      // If due date's day was removed, update due date
      const dueDateDay = dueDate ? getDayNameFromDate(dueDate) : null;
      if (dueDateDay && !validatedDays.includes(dueDateDay) && validatedDays.length > 0) {
        const nextDate = calculateNextDateForDay(validatedDays[0]);
        if (nextDate && onDueDateChange) {
          onDueDateChange(nextDate);
        }
      }
    }
    
    onChangePattern({ ...pattern, interval: validatedInterval, daysOfWeek: validatedDays });
  };

  // Handle due date change - always replace selected day with new due date day
  const handleDueDateChange = (newDueDate) => {
    if (onDueDateChange) {
      onDueDateChange(newDueDate);
    }
    
    // Auto-update selected days if it's a weekly recurrence
    if (recurrence === 'weekly') {
      const dayName = getDayNameFromDate(newDueDate);
      const currentDays = pattern.daysOfWeek || [];
      const interval = pattern.interval || 1;
      
      // Always replace with due date day (for single day interval)
      // Or ensure due date day is included (for multi-day interval)
      if (interval === 1) {
        // Single day: replace selection
        onChangePattern({ ...pattern, daysOfWeek: [dayName] });
      } else {
        // Multiple days: ensure due date day is included
        if (!currentDays.includes(dayName)) {
          const newDays = [dayName, ...currentDays.filter(d => d !== dayName).slice(0, interval - 1)];
          onChangePattern({ ...pattern, daysOfWeek: newDays });
        }
      }
    }
  };

  const maxSelectableDays = pattern.interval || 1;
  const dueDateDay = dueDate ? getDayNameFromDate(dueDate) : null;

  return (
    <div className="p-5 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 mt-6 space-y-5">
      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
        <Repeat size={14} className="text-indigo-500" /> Recurrence Rules
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Frequency</label>
          <div className="relative">
            <select 
              value={recurrence} 
              onChange={(e) => onChangeRecurrence(e.target.value)}
              className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-200 transition-all cursor-pointer"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {recurrence !== 'none' && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Interval</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={pattern.interval || 1}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                className="w-20 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-200 transition-all"
              />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {recurrence === 'daily' ? 'day(s)' : recurrence === 'weekly' ? 'week(s)' : recurrence === 'monthly' ? 'month(s)' : 'year(s)'}
              </span>
            </div>
            {recurrence === 'weekly' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Maximum {pattern.interval || 1} day{pattern.interval !== 1 ? 's' : ''} can be selected
              </p>
            )}
          </div>
        )}
      </div>

      {recurrence === 'weekly' && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Repeat On {pattern.daysOfWeek?.length > 0 && `(${pattern.daysOfWeek.length}/${maxSelectableDays})`}
          </label>
          <div className="flex flex-wrap gap-2">
            {daysOfWeek.map(day => {
              const isSelected = pattern.daysOfWeek?.includes(day);
              const isDisabled = !isSelected && (pattern.daysOfWeek?.length || 0) >= maxSelectableDays;
              const isDueDateDay = dueDateDay === day;
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !isDisabled && handleDayToggle(day)}
                  disabled={isDisabled}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 ${
                    isSelected
                      ? isDueDateDay
                        ? 'bg-indigo-700 text-white border-indigo-700 shadow-sm'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : isDisabled
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600'
                  } ${isDueDateDay ? 'ring-1 ring-offset-1 ring-indigo-400' : ''}`}
                  title={isDueDateDay ? `Due date (${day}) - Click to deselect` : day}
                >
                  {day.substring(0, 3)}
                  {isDueDateDay && <span className="ml-1 text-[10px]">*</span>}
                </button>
              );
            })}
          </div>
          {dueDateDay && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span className="text-indigo-600 dark:text-indigo-400">*</span> Due date: {dueDateDay} (auto-selected)
            </p>
          )}
        </div>
      )}

      {recurrence !== 'none' && (
        <div>
           <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">End Date (Optional)</label>
           <input 
            type="date"
            value={pattern.endDate || ''}
            onChange={(e) => onChangePattern({...pattern, endDate: e.target.value || null})}
            className="text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 w-full focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-slate-200 transition-all"
           />
        </div>
      )}
    </div>
  );
};

const TaskItem = ({ task, onUpdate, onDelete, onCompleteRecurring, onUndoRecurring, categories }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setEditedTask(task);
  }, [task]);

  const handleComplete = (e) => {
    e.stopPropagation();
    
    // If task is already completed, handle undo
    if (task.completed) {
      if (task.recurrence && onUndoRecurring) {
        onUndoRecurring(task.id);
      } else {
        onUpdate(task.id, { ...task, completed: false });
      }
    } 
    // If task is recurring and not completed, handle recurring completion
    else if (task.recurrence) {
      onCompleteRecurring(task.id);
    } 
    // If task is not recurring and not completed, just toggle completion
    else {
      onUpdate(task.id, { ...task, completed: !task.completed });
    }
  };

  const handleSave = () => {
    onUpdate(task.id, editedTask);
    setIsEditing(false);
  };

  const handleDueDateChange = (newDueDate) => {
    setEditedTask({...editedTask, dueDate: newDueDate});
  };

  const isOverdue = !task.completed && isBefore(parseISO(task.dueDate), startOfDay(new Date()));
  const isDueToday = !task.completed && isSameDay(parseISO(task.dueDate), new Date());
  const smartDate = getSmartDateBadge(task.dueDate);

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-slate-200 dark:border-slate-700 p-6 mb-4 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-indigo-500/10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
            <Edit2 size={18} className="text-indigo-600" /> Edit Task
          </h3>
          <button onClick={() => { setIsEditing(false); setEditedTask(task); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Title *</label>
            <input
              type="text"
              value={editedTask.title}
              onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
              className="w-full text-lg font-semibold border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 border px-4 py-3 shadow-sm transition-all"
              placeholder="Task title"
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={editedTask.description}
              onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
              className="w-full text-sm text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 border px-4 py-3 min-h-[100px] shadow-sm transition-all resize-y"
              placeholder="Add some details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label>
              <div className="relative">
                <select 
                  value={editedTask.priority}
                  onChange={(e) => setEditedTask({...editedTask, priority: e.target.value})}
                  className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
              <div className="relative">
                <select 
                  value={editedTask.category}
                  onChange={(e) => setEditedTask({...editedTask, category: e.target.value})}
                  className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  {Object.keys(categories).map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
             <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Due Date *</label>
              <input
                type="date"
                value={editedTask.dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Recurrence</label>
              <div className="relative">
                <select 
                  value={editedTask.recurrence || 'none'}
                  onChange={(e) => setEditedTask({...editedTask, recurrence: e.target.value})}
                  className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <Checklist 
               checklist={editedTask.checklist || []}
               onUpdate={(updatedList) => setEditedTask({...editedTask, checklist: updatedList})}
               isEditingMode={true}
            />

          {(editedTask.recurrence && editedTask.recurrence !== 'none') && (
            <RecurrenceSettings
              recurrence={editedTask.recurrence || 'none'}
              pattern={editedTask.recurrencePattern || { interval: 1, daysOfWeek: [] }}
              onChangeRecurrence={(val) => setEditedTask({...editedTask, recurrence: val, recurrencePattern: val === 'none' ? null : (editedTask.recurrencePattern || { interval: 1, daysOfWeek: [] }) })}
              onChangePattern={(val) => setEditedTask({...editedTask, recurrencePattern: val})}
              dueDate={editedTask.dueDate}
              onDueDateChange={handleDueDateChange}
            />
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button 
              type="button"
              onClick={() => { setIsEditing(false); setEditedTask(task); }}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 dark:shadow-none text-sm font-semibold"
            >
              <Save size={16} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div 
      className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-300 mb-4 ${
        task.completed 
          ? 'opacity-75 border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50' 
          : 'hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-none border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-slate-700 hover:-translate-y-0.5'
      }`}
      style={{ 
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Side Status Indicator - Fixed to be inside the card */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${
        isOverdue ? 'bg-rose-500' : isDueToday ? 'bg-amber-500' : task.priority === 'high' ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-500/30'
      }`} 
        style={{
          borderTopLeftRadius: '0.75rem',
          borderBottomLeftRadius: '0.75rem'
        }}
      />

      <div className="p-5 pl-7 flex gap-5 items-start">
        {/* Checkbox / Complete Button */}
        <button 
          onClick={handleComplete}
          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-sm
            ${task.completed 
              ? 'bg-emerald-500 border-emerald-500 text-white scale-110' 
              : task.recurrence 
                ? 'border-indigo-300 dark:border-indigo-700 text-transparent hover:border-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400 bg-white dark:bg-slate-800' 
                : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500 hover:text-emerald-500 bg-white dark:bg-slate-800'
            }
          `}
        >
          {task.completed ? <Check size={14} strokeWidth={4} /> : task.recurrence ? <Repeat size={12} /> : <Check size={14} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div className="flex justify-between items-start gap-3">
            <h4 className={`font-semibold text-lg text-slate-800 dark:text-slate-100 truncate pr-2 transition-all ${task.completed ? 'line-through text-slate-400 dark:text-slate-500 decoration-slate-300' : ''}`}>
              {task.title}
            </h4>
            
            {/* Quick Actions - Always visible on mobile, Hover on Desktop */}
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 absolute top-4 right-4 md:static md:bg-white/90 md:dark:bg-slate-800/90 md:backdrop-blur-sm md:rounded-lg md:p-1 md:shadow-sm md:border md:border-slate-100 md:dark:border-slate-700">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {task.description && (
            <p className={`text-sm text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed ${task.completed ? 'opacity-60' : ''}`}>{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            {/* Metadata Badges */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${categories[task.category] || categories.work}`}>
              {task.category}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </span>
            
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md shadow-sm border ${smartDate.color} ${smartDate.textColor}`}>
              <Calendar size={13} />
              {smartDate.text}
            </div>

            {task.recurrence && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-md border border-indigo-100 dark:border-indigo-900/30">
                <Repeat size={13} />
                {task.recurrence}
              </div>
            )}
            
            {task.checklist && task.checklist.length > 0 && (
               <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 ml-auto">
                <ListTodo size={13} />
                {task.checklist.filter(i => i.checked).length}/{task.checklist.length}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details (Checklist & Recurrence Info) */}
      {isExpanded && !isEditing && (
        <div className="px-5 pb-5 pt-1 animate-in slide-in-from-top-2 duration-200 pl-7">
           {task.recurrence && (
             <div className="mb-4 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-2.5">
               <Repeat size={14} className="mt-0.5 shrink-0" />
               <span>
                 <strong className="block mb-0.5">Recurring Rule</strong> 
                 {getRecurrenceDisplayText(task)}
               </span>
             </div>
           )}
           <Checklist 
             checklist={task.checklist || []} 
             onUpdate={(newChecklist) => onUpdate(task.id, { ...task, checklist: newChecklist })}
             showProgressBar={true}
           />
        </div>
      )}
    </div>
  );
};

const AddTaskModal = ({ isOpen, onClose, onAdd, categories, setCategories }) => {
  const [task, setTask] = useState({
    title: '', description: '', priority: 'medium', category: 'work',
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'none',
    recurrencePattern: { interval: 1, daysOfWeek: [], endDate: null },
    checklist: []
  });
  const [errors, setErrors] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setTask({
        title: '', description: '', priority: 'medium', category: 'work',
        dueDate: new Date().toISOString().split('T')[0],
        recurrence: 'none',
        recurrencePattern: { interval: 1, daysOfWeek: [], endDate: null },
        checklist: []
      });
      setErrors({});
      setNewCategory('');
      setShowNewCategory(false);
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors = {};
    if (!task.title.trim()) newErrors.title = 'Task title is required';
    if (!task.dueDate) newErrors.dueDate = 'Due date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDueDateChange = (newDueDate) => {
    setTask({...task, dueDate: newDueDate});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    onAdd({
      ...task,
      recurrence: task.recurrence === 'none' ? null : task.recurrence,
      recurrencePattern: task.recurrence === 'none' ? null : task.recurrencePattern,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleAddCategory = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (newCategory.trim()) {
      const categoryKey = newCategory.toLowerCase().trim().replace(/\s+/g, '_');
      
      // Check if category already exists
      if (!categories[categoryKey]) {
        // Create a new category with a random color from a predefined set
        const categoryColors = [
          'bg-blue-50/80 text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-500/30',
          'bg-purple-50/80 text-purple-700 ring-1 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-300 dark:ring-purple-500/30',
          'bg-amber-50/80 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-500/30',
          'bg-cyan-50/80 text-cyan-700 ring-1 ring-cyan-600/20 dark:bg-cyan-900/20 dark:text-cyan-300 dark:ring-cyan-500/30',
          'bg-emerald-50/80 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-500/30',
          'bg-rose-50/80 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-900/20 dark:text-rose-300 dark:ring-rose-500/30',
          'bg-indigo-50/80 text-indigo-700 ring-1 ring-indigo-600/20 dark:bg-indigo-900/20 dark:text-indigo-300 dark:ring-indigo-500/30',
          'bg-teal-50/80 text-teal-700 ring-1 ring-teal-600/20 dark:bg-teal-900/20 dark:text-teal-300 dark:ring-teal-500/30'
        ];
        
        const randomColor = categoryColors[Math.floor(Math.random() * categoryColors.length)];
        const newCategories = { ...categories, [categoryKey]: randomColor };
        
        // Update the categories state
        setCategories(newCategories);
        
        // Save to localStorage
        localStorage.setItem('customCategories', JSON.stringify(newCategories));
      }
      
      // Set the task category to the new category
      setTask({...task, category: categoryKey});
      setNewCategory('');
      setShowNewCategory(false);
    }
  };

  // Add keyboard event listener for Enter key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showNewCategory && e.key === 'Enter' && newCategory.trim()) {
        handleAddCategory();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewCategory, newCategory, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 flex flex-col max-h-[90vh] md:max-h-[85vh] ring-1 ring-white/10">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-10 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Plus size={20} />
            </div>
            New Task
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                What needs to be done? *
              </label>
              <input
                autoFocus
                type="text"
                placeholder="e.g., Review Q3 Marketing Report"
                className={`w-full text-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-300 dark:placeholder:text-slate-600 px-4 py-3 shadow-sm transition-all ${
                  errors.title ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
                }`}
                value={task.title}
                onChange={e => setTask({...task, title: e.target.value})}
                required
              />
              {errors.title && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.title}</p>}
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</label>
              <textarea
                placeholder="Add details, context, or links..."
                className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[100px] px-4 py-3 shadow-sm transition-all resize-y"
                value={task.description}
                onChange={e => setTask({...task, description: e.target.value})}
              />
            </div>

            {/* CATEGORY AND PRIORITY IN SAME ROW ON DESKTOP, STACKED ON MOBILE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* CATEGORY SECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
                <div className="relative">
                  <select 
                    className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                    value={task.category}
                    onChange={e => setTask({...task, category: e.target.value})}
                  >
                    {Object.keys(categories).map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                
                {/* CUSTOM CATEGORY SECTION */}
                <div className="mt-3">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowNewCategory(!showNewCategory);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors border border-indigo-100 dark:border-indigo-800"
                  >
                    <Plus size={14} /> 
                    {showNewCategory ? 'Cancel Custom Category' : 'Add Custom Category'}
                  </button>
                  
                  {showNewCategory && (
                    <div className="mt-3 animate-in slide-in-from-top-2 space-y-3">
                      <div>
                        <input
                          type="text"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Enter category name"
                          className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewCategory(false);
                            setNewCategory('');
                          }}
                          className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                          disabled={!newCategory.trim()}
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        New categories will be saved automatically
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* PRIORITY SECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label>
                <div className="relative">
                  <select 
                    className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                    value={task.priority}
                    onChange={e => setTask({...task, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* DUE DATE AND RECURRENCE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  className={`w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm cursor-pointer ${
                    errors.dueDate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
                  }`}
                  value={task.dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  required
                />
                {errors.dueDate && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{errors.dueDate}</p>}
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Recurrence</label>
                 <div className="relative">
                   <select 
                    className="w-full text-sm border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-2.5 appearance-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-sm"
                    value={task.recurrence}
                    onChange={e => setTask({...task, recurrence: e.target.value})}
                   >
                     <option value="none">Does not repeat</option>
                     <option value="daily">Daily</option>
                     <option value="weekly">Weekly</option>
                     <option value="monthly">Monthly</option>
                     <option value="yearly">Yearly</option>
                   </select>
                   <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                 </div>
              </div>
            </div>

            {task.recurrence !== 'none' && (
              <div className="animate-in slide-in-from-top-2">
                <RecurrenceSettings 
                  recurrence={task.recurrence}
                  pattern={task.recurrencePattern}
                  onChangeRecurrence={(val) => setTask({...task, recurrence: val})}
                  onChangePattern={(val) => setTask({...task, recurrencePattern: val})}
                  dueDate={task.dueDate}
                  onDueDateChange={handleDueDateChange}
                />
              </div>
            )}

            <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Checklist</label>
                <Checklist 
                    checklist={task.checklist}
                    onUpdate={(updatedList) => setTask({...task, checklist: updatedList})}
                    isEditingMode={true}
                />
            </div>
          </form>
        </div>
        
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex justify-end gap-3 flex-shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/50 transition-all"
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
  const [filter, setFilter] = useState('today'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    categories: [],
    priorities: [],
    showCompleted: true,
    dateRange: 'all'
  });
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Categories state
  const [categories, setCategories] = useState(() => {
    const savedCategories = localStorage.getItem('customCategories');
    return savedCategories ? JSON.parse(savedCategories) : DEFAULT_CATEGORIES;
  });

  // PWA Installation states
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Check if this is a first-time user
  const isFirstTimeUser = tasks.length === 0 && !localStorage.getItem('hasCreatedTask');

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    if (tasks.length > 0) {
      localStorage.setItem('hasCreatedTask', 'true');
    }
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    
    // Add custom scrollbar styles
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: ${darkMode ? '#0f172a' : '#f8fafc'};
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: ${darkMode ? '#334155' : '#cbd5e1'};
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: ${darkMode ? '#475569' : '#94a3b8'};
      }
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: ${darkMode ? '#334155 #0f172a' : '#cbd5e1 #f8fafc'};
      }
      
      @supports (padding-bottom: env(safe-area-inset-bottom)) {
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        .safe-area-top {
          padding-top: env(safe-area-inset-top);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('customCategories', JSON.stringify(categories));
  }, [categories]);

  // PWA Installation handling
  useEffect(() => {
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          window.navigator.standalone ||
                          document.referrer.includes('android-app://');
      setIsAppInstalled(isStandalone);
    };

    checkIfInstalled();

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      setTimeout(() => {
        if (!isAppInstalled && localStorage.getItem('installPromptShown') !== 'true') {
          setShowInstallPrompt(true);
        }
      }, 3000);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      localStorage.setItem('installPromptShown', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('load', checkIfInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('load', checkIfInstalled);
    };
  }, [isAppInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsAppInstalled(true);
      localStorage.setItem('installPromptShown', 'true');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const toggleTheme = () => setDarkMode(!darkMode);

  const addTask = (task) => {
    setTasks([...tasks, { ...task, id: Date.now() }]);
    setIsModalOpen(false);
  };
  
  const updateTask = (id, updated) => {
    setTasks(tasks.map(t => t.id === id ? updated : t));
  };
  
  const deleteTask = (id) => setTasks(tasks.filter(t => t.id !== id));

  const handleCompleteRecurring = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const nextDate = calculateNextOccurrence(task, new Date());
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, completed: true } : t);

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

  const handleUndoRecurring = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.recurrence) return;

    const now = new Date();
    const nextOccurrence = tasks.find(t => 
      t.id !== taskId && 
      t.title === task.title && 
      t.recurrence === task.recurrence &&
      isAfter(parseISO(t.dueDate), now) &&
      !t.completed
    );

    let updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, completed: false } : t
    );

    if (nextOccurrence) {
      updatedTasks = updatedTasks.filter(t => t.id !== nextOccurrence.id);
    }

    setTasks(updatedTasks);
  };

  const filteredTasks = useMemo(() => {
    let result = tasks;
    const now = new Date();
    const startOfWeek = startOfDay(addDays(now, -now.getDay()));
    const endOfWeek = addDays(startOfWeek, 6);
    const startOfMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    
    // Apply advanced filters
    if (advancedFilters.categories.length > 0) {
      result = result.filter(t => advancedFilters.categories.includes(t.category));
    }
    
    if (advancedFilters.priorities.length > 0) {
      result = result.filter(t => advancedFilters.priorities.includes(t.priority));
    }
    
    if (!advancedFilters.showCompleted) {
      result = result.filter(t => !t.completed);
    }
    
    switch(advancedFilters.dateRange) {
      case 'today':
        result = result.filter(t => isSameDay(parseISO(t.dueDate), now));
        break;
      case 'week':
        result = result.filter(t => 
          !isBefore(parseISO(t.dueDate), startOfWeek) && 
          !isAfter(parseISO(t.dueDate), endOfWeek)
        );
        break;
      case 'month':
        result = result.filter(t => 
          !isBefore(parseISO(t.dueDate), startOfMonth) && 
          !isAfter(parseISO(t.dueDate), endOfMonth)
        );
        break;
      case 'overdue':
        result = result.filter(t => !t.completed && isBefore(parseISO(t.dueDate), startOfDay(now)));
        break;
    }
    
    // Apply main filter
    switch(filter) {
      case 'active': result = result.filter(t => !t.completed); break;
      case 'completed': result = result.filter(t => t.completed); break;
      case 'overdue': result = result.filter(t => !t.completed && isBefore(parseISO(t.dueDate), startOfDay(now))); break;
      case 'today': result = result.filter(t => !t.completed && isSameDay(parseISO(t.dueDate), now)); break;
      case 'recurring': result = result.filter(t => t.recurrence); break;
      case 'all': break;
      default: result = result.filter(t => !t.completed && isSameDay(parseISO(t.dueDate), now)); break;
    }
    
    // Sort: Overdue first, then by date, then priority
    return result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aOverdue = !a.completed && isBefore(parseISO(a.dueDate), startOfDay(new Date()));
      const bOverdue = !b.completed && isBefore(parseISO(b.dueDate), startOfDay(new Date()));
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [tasks, filter, advancedFilters]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const overdue = tasks.filter(t => !t.completed && isBefore(parseISO(t.dueDate), startOfDay(new Date()))).length;
    const dueToday = tasks.filter(t => !t.completed && isSameDay(parseISO(t.dueDate), new Date())).length;
    const recurring = tasks.filter(t => t.recurrence).length;
    return { total, completed, overdue, dueToday, recurring };
  }, [tasks]);

  // Render install button in header
  const renderInstallButton = () => {
    if (isAppInstalled || !deferredPrompt) return null;
    
    return (
      <button
        onClick={() => setShowInstallPrompt(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <Download size={14} /> Install
      </button>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <div className="flex min-h-screen font-sans text-slate-900 dark:text-slate-100 selection:bg-indigo-100 dark:selection:bg-indigo-900/50 selection:text-indigo-900 dark:selection:text-indigo-100">
        
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-40 px-4 py-3 flex justify-between items-center transition-colors duration-200">
           <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400">
             <div className="bg-indigo-600 text-white p-1 rounded-md">
                <Layout size={18} fill="currentColor" />
             </div>
             <span className="text-slate-900 dark:text-white tracking-tight">CarryOut</span>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={toggleTheme} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
               {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 dark:text-slate-400">
               <Menu size={20} />
             </button>
           </div>
        </div>
  
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none overflow-hidden
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0
        `}>
          {/* Fixed Sidebar Header */}
          <div className="flex-shrink-0">
            <div className="p-6 pb-0">
              <div className="flex items-center justify-between mb-8 pl-2">
                <div className="flex items-center gap-3 font-bold text-2xl text-slate-900 dark:text-white tracking-tight">
                  <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg shadow-indigo-600/30">
                     <Layout size={22} fill="currentColor" />
                  </div>
                  <span>CarryOut</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={24} />
                </button>
                <button 
                  onClick={toggleTheme} 
                  className="hidden md:flex p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
    
              <button 
                onClick={() => { setIsModalOpen(true); setIsSidebarOpen(false); }}
                className="group w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 dark:bg-white dark:hover:bg-indigo-50 dark:text-slate-900 dark:hover:text-indigo-600 text-white py-3.5 px-4 rounded-xl shadow-xl shadow-slate-900/10 dark:shadow-none transition-all duration-300 transform active:scale-95 font-semibold mb-8"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" /> 
                <span>New Task</span>
              </button>
            </div>
          </div>

          {/* Scrollable Sidebar Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-4">
            <nav className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-4">Overview</div>
              {[
                { id: 'all', label: 'All Tasks', icon: Layout, count: stats.total },
                { id: 'today', label: 'Due Today', icon: Clock, count: stats.dueToday, highlight: true },
                { id: 'active', label: 'Active', icon: ListTodo, count: stats.total - stats.completed },
                { id: 'overdue', label: 'Overdue', icon: AlertCircle, count: stats.overdue, alert: true },
                { id: 'recurring', label: 'Recurring', icon: Repeat, count: stats.recurring },
                { id: 'completed', label: 'Completed', icon: CheckCircle2, count: stats.completed },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => { setFilter(item.id); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    filter === item.id 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <item.icon size={18} className={`transition-colors ${
                      filter === item.id ? 'text-indigo-600 dark:text-indigo-400' :
                      item.alert && item.count > 0 ? 'text-rose-500 dark:text-rose-400' : 
                      item.highlight && item.count > 0 ? 'text-amber-500 dark:text-amber-400' : 
                      'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                      item.alert ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 
                      item.highlight ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 
                      filter === item.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                    }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-6">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Productivity</h4>
                  <TrendingUp size={14} className="text-emerald-500" />
               </div>
               
               <div className="space-y-4">
                 <div>
                   <div className="flex justify-between text-xs font-medium mb-1.5">
                     <span className="text-slate-600 dark:text-slate-400">Due Today</span>
                     <span className="text-slate-900 dark:text-slate-200">{stats.dueToday}</span>
                   </div>
                   <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                     <div className="bg-amber-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${Math.min((stats.dueToday / (stats.total || 1)) * 100, 100)}%` }}></div>
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-medium mb-1.5">
                     <span className="text-slate-600 dark:text-slate-400">Completion</span>
                     <span className="text-slate-900 dark:text-slate-200">{Math.round((stats.completed / (stats.total || 1)) * 100)}%</span>
                   </div>
                   <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                     <div className="bg-emerald-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}></div>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </aside>
  
        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950 transition-colors duration-200 relative pt-14 md:pt-0">
           {/* Subtle background decoration */}
           <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-white to-transparent dark:from-slate-900 pointer-events-none opacity-60"></div>

          <header className="flex-shrink-0 px-4 md:px-8 py-4 md:py-6 flex justify-between items-end z-10 sticky top-0 md:top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-transparent transition-all duration-200 md:mt-0">
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {filter === 'all' ? 'All Tasks' : 
                 filter === 'active' ? 'Active Tasks' :
                 filter === 'today' ? "Today's Focus" :
                 filter === 'overdue' ? 'Overdue Tasks' :
                 filter === 'recurring' ? 'Recurring Tasks' :
                 filter === 'completed' ? 'Completed Tasks' :
                 filter.charAt(0).toUpperCase() + filter.slice(1)}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-2 text-xs md:text-sm font-medium">
                <Calendar size={12} className="text-indigo-500" />
                {format(new Date(), 'EEEE, MMMM do, yyyy')}
              </p>
            </div>
            
            <div className="flex gap-2 md:gap-3">
              {/* Install Button for Desktop */}
              {renderInstallButton()}
              
              <button 
                onClick={() => setIsFilterOpen(true)}
                className="p-2 md:p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:shadow-md transition-all"
                title="Filters"
              >
                <Filter size={16} className="md:w-[18px]" />
              </button>
              <button 
                onClick={() => setIsNotificationsOpen(true)}
                className="p-2 md:p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:shadow-md transition-all relative"
                title="Notifications"
              >
                <Bell size={16} className="md:w-[18px]" />
                {stats.overdue > 0 && <span className="absolute top-1.5 md:top-2 right-1.5 md:right-2.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-rose-500 rounded-full border border-white dark:border-slate-900"></span>}
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 md:p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:shadow-md transition-all hidden md:flex"
                title="Settings"
              >
                <Settings size={16} className="md:w-[18px]" />
              </button>
            </div>
          </header>
  
          <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-24 md:pb-10 custom-scrollbar z-0">
            <div className="max-w-4xl mx-auto py-4">
              {stats.overdue > 0 && filter !== 'completed' && filter !== 'overdue' && (
                <div className="mb-8 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-4 flex items-start gap-4 shadow-sm backdrop-blur-sm">
                  <div className="bg-rose-100 dark:bg-rose-900/50 p-2 rounded-xl text-rose-600 dark:text-rose-400">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-700 dark:text-rose-400">You have {stats.overdue} overdue task{stats.overdue > 1 ? 's' : ''}</h4>
                    <p className="text-sm text-rose-600/90 dark:text-rose-300/80 mt-1 font-medium">Review your timeline and reschedule if necessary.</p>
                  </div>
                </div>
              )}

              {filter === 'today' && stats.dueToday === 0 && tasks.length > 0 && (
                <div className="mb-8 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 flex items-start gap-4 shadow-sm backdrop-blur-sm">
                  <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-700 dark:text-emerald-400">All caught up for today!</h4>
                    <p className="text-sm text-emerald-600/90 dark:text-emerald-300/80 mt-1 font-medium">Great job keeping up. Take a break or plan ahead.</p>
                  </div>
                </div>
              )}
  
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-80 animate-in fade-in duration-500">
                  <div className="bg-white dark:bg-slate-900 w-32 h-32 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                       <ListTodo size={48} className="text-indigo-400/80" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {isFirstTimeUser ? "Welcome to CarryOut!" : "No tasks found"}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 text-center max-w-xs font-medium">
                    {isFirstTimeUser 
                      ? "Start organizing your tasks efficiently. Create your first task to begin!" 
                      : filter === 'today' ? "Your schedule is clear for today." 
                      : filter === 'overdue' ? "No overdue tasks. You're on track!"
                      : filter === 'completed' ? "No completed tasks yet."
                      : "You're all caught up! Add a new task to your list."}
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-8 text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all hover:-translate-y-1"
                  >
                    {isFirstTimeUser ? "Create your first task" : "Create new task"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTasks.map(task => (
                    <TaskItem 
                      key={task.id}
                      task={task}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onCompleteRecurring={handleCompleteRecurring}
                      onUndoRecurring={handleUndoRecurring}
                      categories={categories}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
  
        {/* Floating Action Button (Mobile) */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
        >
          <Plus size={24} />
        </button>

        {/* Settings Button (Mobile) */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="md:hidden fixed bottom-6 left-6 z-50 p-4 bg-slate-800 text-white rounded-full shadow-xl shadow-slate-900/40 hover:scale-105 active:scale-95 transition-all"
        >
          <Settings size={24} />
        </button>

        <AddTaskModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onAdd={addTask}
          categories={categories}
          setCategories={setCategories}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onClearData={() => {}}
          darkMode={darkMode}
        />

        <FilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          currentFilter={filter}
          onFilterChange={setAdvancedFilters}
          categories={categories}
          priorities={PRIORITY_COLORS}
          darkMode={darkMode}
        />

        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          tasks={tasks}
          darkMode={darkMode}
        />

        <InstallPromptModal
          isOpen={showInstallPrompt}
          onClose={() => {
            setShowInstallPrompt(false);
            localStorage.setItem('installPromptShown', 'true');
          }}
          onInstall={handleInstallClick}
        />
  
        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default App;
