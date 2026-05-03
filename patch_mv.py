path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\movements.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'ArrowRightLeft,\n} from "lucide-react";',
    'ArrowRightLeft, Trash2,\n} from "lucide-react";'
)
content = content.replace(
    'import { useToast } from "@/hooks/use-toast";',
    'import { useToast } from "@/hooks/use-toast";\nimport { useAuth } from "@/contexts/AuthContext";'
)
content = content.replace(
    'export default function Movements() {\n  const { toast } = useToast();\n  const queryClient = useQueryClient();',
    'export default function Movements() {\n  const { toast } = useToast();\n  const queryClient = useQueryClient();\n  const { isAdmin } = useAuth();'
)

old = '  const resetForm = () => setForm({'
new_block = ('  const deleteMutation = useMutation({\n'
             '    mutationFn: (id: number) => movementsApi.delete(id),\n'
             '    onSuccess: () => {\n'
             '      queryClient.invalidateQueries({ queryKey: ["movements"] });\n'
             '      queryClient.invalidateQueries({ queryKey: ["movements-totals"] });\n'
             '      toast({ title: "\u062a\u0645 \u0627\u0644\u062d\u0630\u0641", description: "\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u062d\u0631\u0643\u0629 \u0628\u0646\u062c\u0627\u062d." });\n'
             '    },\n'
             '    onError: () => toast({ title: "\u062e\u0637\u0623", description: "\u0641\u0634\u0644 \u062d\u0630\u0641 \u0627\u0644\u062d\u0631\u0643\u0629.", variant: "destructive" }),\n'
             '  });\n\n'
             '  const handleDelete = (id: number) => {\n'
             '    if (!window.confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u062d\u0631\u0643\u0629\u061f")) return;\n'
             '    deleteMutation.mutate(id);\n'
             '  };\n\n'
             '  const resetForm = () => setForm({')
content = content.replace(old, new_block)

content = content.replace(
    '<TableHead className="text-center text-xs w-14">\u062a\u0639\u062f\u064a\u0644</TableHead>',
    '<TableHead className="text-center text-xs w-14">\u062a\u0639\u062f\u064a\u0644</TableHead>\n                  {isAdmin && <TableHead className="text-center text-xs w-14">\u062d\u0630\u0641</TableHead>}'
)

old_btn = ('                    <TableCell className="text-center">\n'
           '                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10" title="\u062a\u0639\u062f\u064a\u0644" onClick={() => openEdit(m)}>\n'
           '                        <Pencil className="w-3 h-3" />\n'
           '                      </Button>\n'
           '                    </TableCell>')
new_btn = (old_btn +
           '\n                    {isAdmin && (\n'
           '                      <TableCell className="text-center">\n'
           '                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="\u062d\u0630\u0641" onClick={() => handleDelete(m.id)} disabled={deleteMutation.isPending}>\n'
           '                          <Trash2 className="w-3 h-3" />\n'
           '                        </Button>\n'
           '                      </TableCell>\n'
           '                    )}')
content = content.replace(old_btn, new_btn)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
