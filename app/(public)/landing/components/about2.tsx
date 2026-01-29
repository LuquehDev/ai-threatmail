"use client";
import { Megaphone } from "lucide-react";
import { motion, useInView, easeOut, Variants } from "framer-motion";
import { useRef } from "react";

export default function AboutUsTwo() {
  const ref = useRef<HTMLDivElement | null>(null);

  const inView = useInView(ref, {
    once: true,
    margin: "-20%",
  });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: easeOut,
      },
    },
  };

  const imageVariants: Variants = {
    hidden: { opacity: 0, x: -100 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        ease: easeOut,
        delay: 0,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full h-auto flex px-24 gap-16 overflow-hidden items-center"
      id="aboutus"
    >
      <motion.img
        src="aboutus2.png"
        alt="About us image"
        className="h-100"
        variants={imageVariants}
      />
      <motion.div className="flex flex-col" variants={itemVariants}>
        <span className="flex items-center gap-1 text-xs montserrat tracking-[.2em] text-violet-400">
          <Megaphone className="size-2.5" />
          About Us
        </span>

        <h2 className="text-4xl font-bold text-white max-w-3xl">
          Why Does it Works?
        </h2>

        <span className="text-white/75 font-light text-xs text-left montserrat mt-5">
          It works because phishing attacks follow patterns — and our system is
          designed to recognize them. By analyzing the full structure of an
          email, including its content, metadata, links, and attachments, the AI
          identifies inconsistencies and behaviors commonly associated with
          phishing. Machine learning models learn from real attack data,
          allowing the system to detect both known and emerging threats.
          Combined with external security analysis services chosen by the user,
          this approach provides a layered and reliable evaluation. Most
          importantly, the results are translated into clear, human-readable
          insights and actionable mitigation steps, enabling users to understand
          the threat and respond effectively.
        </span>
      </motion.div>
    </motion.div>
  );
}
