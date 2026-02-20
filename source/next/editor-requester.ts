import { EditorRequester } from './models';

export const defaultEditorRequester: EditorRequester = async (channel: string, method: string, ...args: any[]) => {
    const editorAny = (globalThis as any).Editor;
    if (!editorAny || !editorAny.Message || typeof editorAny.Message.request !== 'function') {
        throw new Error('Editor.Message.request is not available');
    }
    return editorAny.Message.request(channel, method, ...args);
};
