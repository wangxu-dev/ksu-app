import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  Menubar,
} from "@/components/ui/menubar";

function App() {
  return (
    <div className="p-4">
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarItem>Open</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Quit</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>About</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <div className="mt-8">
        <h1 className="text-2xl font-bold">Ksu-App</h1>
        <p className="text-muted-foreground">
          A unified portal integrating multiple campus systems for Kashgar University.
        </p>
      </div>
    </div>
  );
}

export default App;
