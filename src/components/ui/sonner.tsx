import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:border-rose-200 group-[.toaster]:shadow-lg dark:group-[.toaster]:border-rose-900/60",
          success: "group-[.toaster]:border-emerald-200 group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-950 dark:group-[.toaster]:border-emerald-900/60 dark:group-[.toaster]:bg-emerald-950 dark:group-[.toaster]:text-emerald-50",
          error: "group-[.toaster]:border-rose-200 group-[.toaster]:bg-rose-50 group-[.toaster]:text-rose-950 dark:group-[.toaster]:border-rose-900/60 dark:group-[.toaster]:bg-rose-950 dark:group-[.toaster]:text-rose-50",
          warning: "group-[.toaster]:border-rose-200 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-950 dark:group-[.toaster]:border-rose-900/60 dark:group-[.toaster]:bg-amber-950 dark:group-[.toaster]:text-amber-50",
          info: "group-[.toaster]:border-rose-200 group-[.toaster]:bg-sky-50 group-[.toaster]:text-sky-950 dark:group-[.toaster]:border-rose-900/60 dark:group-[.toaster]:bg-sky-950 dark:group-[.toaster]:text-sky-50",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
