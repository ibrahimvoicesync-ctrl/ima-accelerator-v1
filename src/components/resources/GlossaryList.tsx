"use client";

import { useState } from "react";
import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_user: { name: string } | null;
}

interface GlossaryListProps {
  terms: GlossaryTerm[];
  canManage: boolean;
  onEdit: (term: GlossaryTerm) => void;
  onDelete: (id: string) => void;
}

export function GlossaryList({ terms, canManage, onEdit, onDelete }: GlossaryListProps) {
  const [search, setSearch] = useState("");

  const filtered = terms.filter((t) =>
    t.term.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, GlossaryTerm[]>>((acc, term) => {
    const letter = term.term[0]?.toUpperCase() ?? "#";
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(term);
    return acc;
  }, {});

  const sortedLetters = Object.keys(grouped).sort();

  return (
    <div className="space-y-2">
      <Input
        placeholder="Search glossary terms..."
        aria-label="Search glossary terms"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
          title="No glossary terms found"
          description={search ? "Try a different search term." : "No glossary terms have been added yet."}
        />
      ) : (
        <dl>
          {sortedLetters.map((letter) => (
            <div key={letter}>
              <h3 className="text-lg font-bold text-ima-primary mt-6 mb-2 border-b border-ima-border pb-1">
                {letter}
              </h3>
              {grouped[letter].map((term) => (
                <div key={term.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-base font-semibold text-ima-text">{term.term}</dt>
                    {canManage && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(term)}
                          aria-label={"Edit " + term.term}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(term.id)}
                          aria-label={"Delete " + term.term}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <dd className="text-sm text-ima-text-secondary mt-1">{term.definition}</dd>
                </div>
              ))}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
