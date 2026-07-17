import React from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock, Edit2, Trash2, Plus } from 'lucide-react';
import { ChurchEvent } from '../types';
import { EventBadge } from './EventBadge';
import { cn, toSafeDate } from '../lib/utils';

interface WeeklyViewProps {
  currentDate: Date;
  events: ChurchEvent[];
  isAdmin?: boolean;
  onEdit?: (event: ChurchEvent) => void;
  onDelete?: (id: string) => void;
  onAddEvent?: (date: Date) => void;
}

export function WeeklyView({ currentDate, events, isAdmin, onEdit, onDelete, onAddEvent }: WeeklyViewProps) {
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday

  const days = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  return (
    <div className="space-y-6">
      {days.map((day, i) => {
        const dayEvents = events.filter((e) => isSameDay(toSafeDate(e.date), day));
        
        const dayIsToday = isToday(day);

        return (
          <div 
            key={`week-day-${format(day, 'yyyy-MM-dd')}-${i}`} 
            className={cn(
              "bg-white rounded-xl shadow-sm border overflow-hidden transition-all",
              dayIsToday 
                ? "border-blue-400 ring-2 ring-blue-500/10 shadow-md scale-[1.01] sm:scale-100" 
                : "border-slate-200"
            )}
          >
            <div className={cn(
              "px-3 py-2.5 sm:px-4 sm:py-3 border-b flex flex-col min-[480px]:flex-row min-[480px]:items-center justify-between gap-2",
              dayIsToday ? "bg-blue-50/60 border-blue-150" : "bg-slate-50 border-slate-200"
            )}>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className={cn(
                  "text-base sm:text-lg font-bold capitalize leading-tight",
                  dayIsToday ? "text-blue-700" : "text-slate-800"
                )}>
                  {dayIsToday 
                    ? `Hoje - ${format(day, 'EEEE', { locale: ptBR })}` 
                    : format(day, 'EEEE', { locale: ptBR })}
                </span>
                <span className={cn(
                  "text-xs sm:text-sm",
                  dayIsToday ? "text-blue-600/80 font-medium" : "text-slate-500"
                )}>
                  {format(day, "dd 'de' MMMM", { locale: ptBR })}
                </span>
                {dayIsToday && (
                  <span className="bg-blue-600 text-white text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider animate-pulse shadow-sm shadow-blue-600/15">
                    Hoje
                  </span>
                )}
              </div>
              <div className={cn(
                "text-xs sm:text-sm font-semibold",
                dayIsToday ? "text-blue-700" : "text-slate-400 min-[480px]:text-slate-500"
              )}>
                {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {dayEvents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm py-8 flex flex-col items-center justify-center gap-3">
                  <span>Nenhum evento programado para este dia.</span>
                  <button
                    onClick={() => onAddEvent?.(day)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md text-xs font-semibold transition-colors cursor-pointer border border-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Evento
                  </button>
                </div>
              ) : (
                dayEvents.map((event, index) => (
                  <div key={`weekly-event-${event.id || 'no-id'}-${index}-${format(day, 'yyyy-MM-dd')}`} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex flex-col md:flex-row gap-4 items-start flex-1 min-w-0">
                                                <div className="space-y-2 flex-1 min-w-0">
                          {event.bannerUrl && (
                            <div className="w-full h-36 rounded-lg overflow-hidden mb-2 border border-slate-100 shadow-sm relative bg-slate-50">
                              <img 
                                src={event.bannerUrl} 
                                alt={event.title} 
                                className="w-full h-full object-cover" 
                                style={{
                                  WebkitMaskImage: 'linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.1) 4%, black 35%)',
                                  maskImage: 'linear-gradient(to left, transparent 0%, rgba(0, 0, 0, 0.1) 4%, black 35%)'
                                }}
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-slate-900 break-words break-all leading-tight flex-1 min-w-0">{event.title}</h3>
                            <EventBadge category={event.category} />
                          </div>
                          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-2xl break-words break-all whitespace-pre-line">
                            {event.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row lg:flex-col gap-2 sm:gap-4 lg:gap-2 min-w-[140px] max-w-full text-xs font-semibold text-slate-600 bg-slate-50 lg:bg-transparent p-2.5 lg:p-0 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>
                            {event.startTime} - {event.endTime}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 lg:flex-col justify-end lg:justify-center border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-4">
                          <button 
                            className="p-2 text-blue-600 hover:bg-blue-50 border border-slate-100 hover:border-blue-100 rounded-lg transition-all cursor-pointer" 
                            title="Editar evento"
                            onClick={() => onEdit?.(event)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            className="p-2 text-red-600 hover:bg-red-50 border border-slate-100 hover:border-red-100 rounded-lg transition-all cursor-pointer" 
                            title="Excluir evento"
                            onClick={() => onDelete?.(event.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
