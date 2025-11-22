// CommandPalette.tsx
import { motion, AnimatePresence } from "framer-motion";
export default function CommandPalette({ open, onClose, actions }:{
  open:boolean; onClose:()=>void; actions: {label:string, run:()=>void}[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          />
          <motion.div
            className="relative mx-auto mt-24 w-[92vw] max-w-xl"
            initial={{opacity:0, y:8, scale:.98}}
            animate={{opacity:1, y:0, scale:1}}
            exit={{opacity:0, y:8, scale:.98}}
            transition={{duration:.18}}
          >
            <div className="rounded-2xl border border-black/10 bg-white shadow-lg">
              <input
                autoFocus
                placeholder="Type a command…"
                className="w-full h-12 px-4 rounded-t-2xl outline-none"
              />
              <div className="p-2">
                {actions.map((a,i)=>(
                  <button
                    key={i}
                    onClick={()=>{a.run(); onClose();}}
                    className="w-full text-left rounded-xl px-3 py-2 hover:bg-black/5"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
