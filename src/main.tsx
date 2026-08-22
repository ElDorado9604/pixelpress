import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { PixelpressApp } from "@/components/pixelpress/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <PixelpressApp />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          className: "!bg-surface !text-fg !border-border !font-sans",
        }}
      />
    </TooltipProvider>
  </StrictMode>,
);
