"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import {
  aspectRatioOptions,
  creditFee,
  defaultValues,
  transformationTypes,
} from "@/constants";

import { CustomField } from "./CustomField";
import MediaUploader from "./MediaUploader";
import TransformedImage from "./TransformedImage";
import { InsufficientCreditsModal } from "./InsufficientCreditsModal";

import { AspectRatioKey, debounce, deepMergeObjects } from "@/lib/utils";
import { updateCredits } from "@/lib/actions/user.actions";
import { getCldImageUrl } from "next-cloudinary";
import { addImage, updateImage } from "@/lib/actions/image.actions";

// ✅ Validation schema
export const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  aspectRatio: z.string().optional(),
  color: z.string().optional(),
  prompt: z.string().optional(),
  publicId: z.string().min(1, "Image is required"),
});

// ✅ Main Component
const TransformationForm = ({
  action,
  data = null,
  userId,
  type,
  creditBalance,
  config = null,
}: TransformationFormProps) => {
  const transformationType = transformationTypes[type];
  const [image, setImage] = useState<any>(data);
  const [newTransformation, setNewTransformation] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformationConfig, setTransformationConfig] = useState(config);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // ✅ Form initial values
  const initialValues =
    data && action === "Update"
      ? {
          title: data.title,
          aspectRatio: data.aspectRatio,
          color: data.color,
          prompt: data.prompt,
          publicId: data.publicId,
        }
      : defaultValues;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  // ✅ On Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      if (!image) throw new Error("No image selected");

      const transformationUrl = getCldImageUrl({
        width: image.width,
        height: image.height,
        src: image.publicId,
        ...transformationConfig,
      });

      const imageData = {
        title: values.title,
        publicId: image.publicId,
        transformationType: type,
        width: image.width,
        height: image.height,
        config: transformationConfig,
        secureURL: image.secureURL,
        transformationURL: transformationUrl,
        aspectRatio: values.aspectRatio,
        prompt: values.prompt,
        color: values.color,
      };

      if (action === "Add") {
        const newImage = await addImage({
          image: imageData,
          userId,
          path: "/",
        });

        if (newImage) {
          form.reset();
          setImage(null);
          router.push(`/transformations/${newImage._id}`);
        }
      } else if (action === "Update") {
        const updatedImage = await updateImage({
          image: {
            ...imageData,
            _id: data._id,
          },
          userId,
          path: `/transformations/${data._id}`,
        });

        if (updatedImage) {
          router.push(`/transformations/${updatedImage._id}`);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ✅ Select Aspect Ratio
  const onSelectFieldHandler = (
    value: string,
    onChangeField: (value: string) => void
  ) => {
    const imageSize = aspectRatioOptions[value as AspectRatioKey];

    setImage((prev: any) => ({
      ...prev,
      aspectRatio: imageSize.aspectRatio,
      width: imageSize.width,
      height: imageSize.height,
    }));

    setNewTransformation(transformationType.config);
    onChangeField(value);
  };

  // ✅ Input Handler (prompt/color)
  const onInputChangeHandler = (
    fieldName: string,
    value: string,
    type: string,
    onChangeField: (value: string) => void
  ) => {
    debounce(() => {
      setNewTransformation((prev: any) => ({
        ...prev,
        [type]: {
          ...prev?.[type],
          [fieldName === "prompt" ? "prompt" : "to"]: value,
        },
      }));
    }, 1000)();

    onChangeField(value);
  };

  // ✅ Apply transformation
  const onTransformHandler = async () => {
    setIsTransforming(true);

    setTransformationConfig((prev: any) =>
      deepMergeObjects(newTransformation, prev)
    );
    setNewTransformation(null);

    startTransition(async () => {
      await updateCredits(userId, creditFee);
    });

    setTimeout(() => setIsTransforming(false), 1500);
  };

  // ✅ Preload config for certain types
  useEffect(() => {
    if (image && ["restore", "removeBackground"].includes(type as string)) {
      setNewTransformation(transformationType.config);
    }
  }, [image, transformationType.config, type]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {creditBalance < Math.abs(creditFee) && <InsufficientCreditsModal />}

        {/* 🏷️ Image Title */}
        <CustomField
          control={form.control}
          name="title"
          formLabel="Image Title"
          className="w-full"
          render={({ field }) => (
            <Input
              {...field}
              placeholder="Enter image title"
              className="input-field"
            />
          )}
        />

        {/* 📐 Aspect Ratio (only for fill) */}
        {type === "fill" && (
          <CustomField
            control={form.control}
            name="aspectRatio"
            formLabel="Aspect Ratio"
            className="w-full"
            render={({ field }) => (
              <Select
                onValueChange={(value) =>
                  onSelectFieldHandler(value, field.onChange)
                }
                value={field.value}
              >
                <SelectTrigger className="select-field">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(aspectRatioOptions).map((key) => (
                    <SelectItem key={key} value={key} className="select-item">
                      {aspectRatioOptions[key as AspectRatioKey].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}

        {/* 🎨 Prompt & Color */}
        {(type === "remove" || type === "recolor") && (
          <div className="prompt-field">
            <CustomField
              control={form.control}
              name="prompt"
              formLabel={
                type === "remove" ? "Object to Remove" : "Object to Recolor"
              }
              className="w-full"
              render={({ field }) => (
                <Input
                  value={field.value}
                  placeholder="Describe object..."
                  className="input-field"
                  onChange={(e) =>
                    onInputChangeHandler(
                      "prompt",
                      e.target.value,
                      type,
                      field.onChange
                    )
                  }
                />
              )}
            />

            {type === "recolor" && (
              <CustomField
                control={form.control}
                name="color"
                formLabel="Replacement Color"
                className="w-full"
                render={({ field }) => (
                  <Input
                    value={field.value}
                    placeholder="e.g. blue, red..."
                    className="input-field"
                    onChange={(e) =>
                      onInputChangeHandler(
                        "color",
                        e.target.value,
                        "recolor",
                        field.onChange
                      )
                    }
                  />
                )}
              />
            )}
          </div>
        )}

        {/* 🖼️ Image Upload & Preview */}
        <div className="media-uploader-field">
          <CustomField
            control={form.control}
            name="publicId"
            className="flex size-full flex-col"
            render={({ field }) => (
              <MediaUploader
                onValueChange={field.onChange}
                setImage={setImage}
                publicId={field.value}
                image={image}
                type={type}
              />
            )}
          />

          <TransformedImage
            image={image}
            type={type}
            title={form.getValues().title}
            isTransforming={isTransforming}
            setIsTransforming={setIsTransforming}
            transformationConfig={transformationConfig}
          />
        </div>

        {/* 🧭 Buttons */}
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            className="submit-button capitalize"
            disabled={isTransforming || newTransformation === null}
            onClick={onTransformHandler}
          >
            {isTransforming ? "Transforming..." : "Apply Transformation"}
          </Button>
          <Button
            type="submit"
            className="submit-button capitalize"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Save Image"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TransformationForm;
