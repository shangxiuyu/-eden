import React, { useMemo } from "react";
// @ts-ignore
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
// @ts-ignore
import { Label } from "@/components/ui/label";
// @ts-ignore
import { Input } from "@/components/ui/input";
// @ts-ignore
import { Button } from "@/components/ui/button";
// @ts-ignore
import { Switch } from "@/components/ui/switch";
// @ts-ignore
import { Separator } from "@/components/ui/separator";
import type { A2UIMessage, A2UIComponent, A2UIUserAction } from "@shared/types";

interface A2UIRendererProps {
  agentId: string;
  message?: A2UIMessage;
  onAction: (agentId: string, action: A2UIUserAction) => void;
}

export const A2UIRenderer: React.FC<A2UIRendererProps> = ({ agentId, message, onAction }) => {
  if (!message) return null;

  const { root, components } = useMemo(() => {
    if (message.beginRendering) {
      return { root: message.beginRendering.root, components: [] as A2UIComponent[] };
    }
    if (message.surfaceUpdate) {
      return {
        root: message.surfaceUpdate.components[0]?.id,
        components: message.surfaceUpdate.components,
      };
    }
    return { root: null, components: [] as A2UIComponent[] };
  }, [message]);

  const componentMap = useMemo(() => {
    const map = new Map<string, A2UIComponent>();
    if (message.surfaceUpdate?.components) {
      message.surfaceUpdate.components.forEach((c) => map.set(c.id, c));
    }
    return map;
  }, [message]);

  const renderComponent = (id?: string | null): React.ReactNode => {
    if (!id) return null;
    const comp = componentMap.get(id);
    if (!comp) return null;

    const props = comp.componentProperties;
    const type = Object.keys(props)[0];
    const data = props[type];

    switch (type) {
      case "Heading":
        return (
          <h3 key={id} className="text-lg font-semibold mb-2">
            {data.text}
          </h3>
        );
      case "Text":
        return (
          <p key={id} className="text-sm text-muted-foreground whitespace-pre-wrap">
            {data.text}
          </p>
        );
      case "TextField":
        return (
          <div key={id} className="space-y-2">
            <Label className="text-sm font-medium">{data.label}</Label>
            <div className="flex gap-2">
              <Input
                value={data.value || ""}
                placeholder={data.placeholder}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onAction(agentId, {
                    actionId: "value_change",
                    componentId: id,
                    data: { value: e.target.value },
                  })
                }
                className="h-9"
              />
            </div>
          </div>
        );
      case "Button":
        return (
          <Button
            key={id}
            size="sm"
            variant={(data.variant as any) || "default"}
            onClick={() => onAction(agentId, { actionId: data.action || "click", componentId: id })}
          >
            {data.label}
          </Button>
        );
      case "CheckBox":
      case "Switch":
        return (
          <div key={id} className="flex items-center justify-between py-2">
            <Label className="text-sm font-medium">{data.label}</Label>
            <Switch
              checked={!!data.value}
              onCheckedChange={(checked: boolean) =>
                onAction(agentId, { actionId: "toggle", componentId: id, data: { checked } })
              }
            />
          </div>
        );
      case "Divider":
        return <Separator key={id} className="my-4" />;
      case "Row":
        return (
          <div key={id} className="flex flex-row gap-4 items-center">
            {data.children?.explicitList?.map((childId: string) => renderComponent(childId))}
          </div>
        );
      case "Column":
        return (
          <div key={id} className="flex flex-col gap-4">
            {data.children?.explicitList?.map((childId: string) => renderComponent(childId))}
          </div>
        );
      case "Card":
        return (
          <Card key={id} className="bg-card/40 border-border/30">
            {data.title && (
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{data.title}</CardTitle>
              </CardHeader>
            )}
            <CardContent className="space-y-4">{renderComponent(data.child)}</CardContent>
          </Card>
        );
      default:
        return (
          <div key={id} className="text-xs text-red-500">
            Unknown component: {type}
          </div>
        );
    }
  };

  return (
    <div className="a2ui-surface space-y-4">
      {root ? renderComponent(root) : components.map((c) => renderComponent(c.id))}
    </div>
  );
};
