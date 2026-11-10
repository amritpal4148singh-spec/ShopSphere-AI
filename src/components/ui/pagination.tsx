import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPageItems } from "@/utils/discovery";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>

      {getPageItems(page, totalPages).map((item, index) =>
        item === "ellipsis" ? (
          <span key={`ellipsis-${index}`} aria-hidden="true" className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? "default" : "outline"}
            size="sm"
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ),
      )}

      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
