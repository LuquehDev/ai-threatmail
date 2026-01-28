"use client";
import { Slack, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function HeroSection() {
  const [selectedOption, setSelectedOption] = useState("start");
  const options = [
    {
      label: "Start",
      value: "start",
      selected: selectedOption === "start",
    },
    {
      label: "About us",
      value: "aboutus",
      selected: selectedOption === "aboutus",
    },
    {
      label: "Protection",
      value: "protection",
      selected: selectedOption === "protection",
    },
    {
      label: "How it Works",
      value: "howitworks",
      selected: selectedOption === "howitworks",
    },
    {
      label: "Feedbacks",
      value: "feedbacks",
      selected: selectedOption === "feedbacks",
    },
  ];

  return (
    <div className="w-screen overflow-hidden">
      <section
        className="flex flex-col items-center relative h-full w-full gap-12"
        id="start"
      >
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-3 items-center px-24 mt-6 z-10"
        >
          <div className="flex justify-start">
            <Slack color="#8F78FF" className="size-10" />
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="rounded-full border-t border-white/30 p-px">
              <div className="flex gap-6 font-normal text-xs text-white/65 bg-white/5 px-8 py-4 rounded-full">
                {options.map((option, idx) => (
                  <motion.a
                    key={option.value}
                    href={`#${option.value}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                    className="flex items-center gap-1 group transition-all duration-200 text-nowrap"
                    onClick={() => setSelectedOption(option.value)}
                  >
                    {option.selected && (
                      <div className="flex items-center justify-center w-2 h-2 bg-violet-300/10 rounded-full animate-pulse transition-all duration-200">
                        <div className="w-1 h-1 bg-violet-600 rounded-full animate-pulse transition-all duration-200"></div>
                      </div>
                    )}
                    <span
                      className={`${
                        option.selected
                          ? "text-violet-500 font-medium"
                          : "text-white/75 hover:scale-102 hover:text-white"
                      } transition-all duration-200`}
                    >
                      {option.label}
                    </span>
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex justify-end"
          >
            <button
              className="bg-linear-to-r from-violet-500 to-violet-900
              px-6 py-2.5 rounded-full text-sm font-semibold text-white
              cursor-pointer
              shadow-[0_0_20px_rgba(139,92,246,0.3)]
              hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]
              hover:scale-102 transition-all duration-200"
            >
              Start for Free
            </button>
          </motion.div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col items-center gap-3 z-11"
        >
          <span className="flex items-center gap-1 text-xs montserrat tracking-[.2em] text-violet-400">
            <Sparkles className="size-2.5" />
            AI ThreatMail
          </span>
          <h1 className="text-5xl font-bold text-white inter text-center">
            Your <span className="text-violet-400">BEST AI</span> <br />
            Phishing Preventor
          </h1>
          <span className="text-white/75 font-light text-xs text-center montserrat">
            Protect your emails from phishing attacks with our AI-powered
            solution. <br /> Stay secure as it intelligently identifies threats
            and alerts about malicious content.
          </span>
          <div className=" flex items-center gap-6 mt-4">
            <button
              className="bg-linear-to-r from-violet-500 to-violet-900
              px-6 py-2.5 rounded-full text-sm font-semibold text-white
              cursor-pointer
              shadow-[0_0_20px_rgba(139,92,246,0.3)]
              hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]
              hover:scale-102 transition-all duration-200"
            >
              Start for Free
            </button>
            <a
              href="#howitworks"
              className="hover:bg-linear-to-r hover:from-violet-500 hover:to-violet-900
              px-6 py-2.5 rounded-full text-sm font-semibold text-white
              cursor-pointer
              ring-1 ring-white/30
              hover:ring-0
              hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]
              hover:scale-102 transition-all duration-200"
            >
              How it works
            </a>
          </div>

          <motion.img
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            src="dashboard.png"
            alt="chatbot image"
            className="h-150 mt-8"
          />
        </motion.div>
        <div
          className="h-180 w-full absolute pointer-events-none rounded-bl-[40px] rounded-br-[200px]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(1, 3, 21, 0.7) 0%, rgba(90, 48, 255, 0.7) 56%, rgba(127, 94, 255, 0.7) 82%, rgba(177, 157, 255, 0.7) 100%)",
          }}
        />
        <div className="absolute pointer-events-none top-8 -right-15 w-70 h-70 bg-linear-to-l from-white/0 to-white/8 rounded-full z-9" />
        <div className="absolute pointer-events-none top-99 -left-10 w-80 h-80 bg-linear-to-r from-white/0 to-white/12 rounded-full z-9" />
      </section>
    </div>
  );
}
