"use client";
import { Megaphone } from "lucide-react";
import { motion, useInView, easeOut, Variants } from "framer-motion";
import { useRef } from "react";

export default function AboutUs() {
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
    hidden: { opacity: 0, x: 100 },
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
      <motion.div className="flex flex-col" variants={itemVariants}>
        <span className="flex items-center gap-1 text-xs montserrat tracking-[.2em] text-violet-400">
          <Megaphone className="size-2.5" />
          About Us
        </span>

        <h2 className="text-4xl font-bold text-white max-w-3xl">
          What is a "AI Phishing Preventor"?
        </h2>

        <span className="text-white/75 font-light text-xs text-left montserrat mt-5">
          An AI Phishing Preventor is an intelligent security solution designed
          to help users detect and understand phishing emails in a simple and
          accessible way. Phishing attacks often impersonate legitimate messages
          to steal sensitive information or deliver malicious content. The
          system analyzes the full email data, including subject, text, links,
          headers, and attachments, using machine learning techniques such as a
          perceptron to identify suspicious patterns.
          <br />
          <br />
          Attachments are scanned using security analysis services selected by
          the user, allowing flexible integration with different threat
          intelligence providers. Instead of technical alerts, the AI delivers a
          clear, human-readable explanation of the risks involved, along with
          practical mitigation measures to help users make safer decisions. In
          essence, an AI Phishing Preventor acts as a smart assistant that
          transforms complex security analysis into understandable and
          actionable insights.
        </span>
      </motion.div>

      <motion.img
        src="aboutus.png"
        alt="About us image"
        className="h-100"
        variants={imageVariants}
      />
    </motion.div>
  );
}
