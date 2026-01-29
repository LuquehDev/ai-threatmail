import Hero from "./components/herosection";
import AboutUs from "./components/about";
import AboutUsTwo from "./components/about2";

export default function Landing() {
  return (
    <div className="flex flex-col w-screen h-full gap-40">
      <Hero />
      <AboutUs />
      <AboutUsTwo />
    </div>
  );
}
