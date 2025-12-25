//Si la pantalla del dispositivo es mayor a 549, se ejecuta este código.
if (window.innerWidth > 549) {
  // Variables globales
  let global_number_of_pages = 0;
  //Función constructora del objeto PDF
  var PDFAnnotate = function (container_id, url, options = {}) {
    this.number_of_pages = 0; //Número de páginas del pdf
    this.pages_rendered = 0; //Número de páginas renderizadas
    this.active_tool = 0; //Identificador de la herramienta activa
    this.fabricObjects = []; //Lista con los objetos de Fabric
    this.fabricObjectsData = []; //Lista con los
    this.color = "rgba(33, 33, 33, 1)"; //Color actual seleccionado
    this.font_size = 25; //Tamaño de la fuente de letra para texto
    this.active_canvas = 0; //Identificador el canvas activo
    this.container_id = container_id; //Identificador del contenedor del pdf
    this.url = url; //Dirección donde se encuentra el pdf
    this.anterior = "rgba(33, 33, 33, 1)"; //Variable de soporte que guarda el color anterior utilizado
    this.resaltador_last = false; //Variable de soporte que indica si la herramienta anterior fue el resaltador
    var current_PDFAnnotate = this; // Referencia personalizada al objeto actual mediante "this"
    //Carga el documento con una promesa
    var loadingTask = pdfjsLib.getDocument(this.url);
    //Código cuando la promesa se cumple satisfactoriamente
    loadingTask.promise.then(
      function (pdf) {
        //Objeto que contiene las promesas
        let promises = Promise.resolve();
        //Opción de escalamiento del pdf
        var scale;
        if (options.scale) {
          scale = options.scale;
        } else {
          scale = 1.3;
        }
        //Número de páginas del pdf
        current_PDFAnnotate.number_of_pages = pdf.numPages;
        global_number_of_pages = pdf.numPages;
        //Renderización página por página del documento en un canvas dentro del HTML
        for (let i = 1; i <= pdf.numPages; i++) {
          // Encadenar las promesas para que se resuelvan en orden
          promises = promises.then(() => {
            return pdf.getPage(i).then(function (page) {
              // Escala el tamaño del pdf dependiendo de la pantalla
              var viewport = page.getViewport({ scale: scale });
              // Creación en memoria del canvas donde estará la página
              var canvas = document.createElement("canvas");
              // Se agrega el canvas creado como hijo del elemento contenedor
              document
                .getElementById(current_PDFAnnotate.container_id)
                .appendChild(canvas);
              // Añadir características al canvas y su contexto en context
              canvas.className = "pdf-canvas";
              let canvas_id = "page-" + i + "-canvas";
              canvas.id = canvas_id;
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              let context = canvas.getContext("2d");
              // Renderización de la página en el canvas
              var renderTask = page.render({
                canvasContext: context,
                viewport: viewport,
              });

              return renderTask.promise.then(function () {
                let canvas = $("#" + canvas_id)[0];
                let index = i - 1;
                var background = canvas.toDataURL("image/png");
                // Se establece el objeto del pincel para cada página del pdf
                var fabricObj = new fabric.Canvas(canvas.id, {
                  freeDrawingBrush: {
                    width: 3,
                    color: current_PDFAnnotate.color,
                  },
                  isDrawingMode: true,
                });
                current_PDFAnnotate.fabricObjects.push(fabricObj);
                $.each(
                  current_PDFAnnotate.fabricObjects,
                  function (index, fabricObj) {
                    fabricObj.freeDrawingBrush.width = 3;
                  }
                );
                // Guarda los objetos creados dentro cada página
                if (typeof options.onPageUpdated === "function") {
                  fabricObj.on("object:added", function () {
                    var oldValue = Object.assign(
                      {},
                      current_PDFAnnotate.fabricObjectsData[index]
                    );
                    current_PDFAnnotate.fabricObjectsData[index] =
                      fabricObj.toJSON();
                    options.onPageUpdated(
                      index + 1,
                      oldValue,
                      current_PDFAnnotate.fabricObjectsData[index]
                    );
                  });
                }
                // Renderiza cada página con los cambios hechos con Fabric
                fabricObj.setBackgroundImage(
                  background,
                  fabricObj.renderAll.bind(fabricObj)
                );
                // Añadir objetos tipo texto haciendo click
                $(fabricObj.upperCanvasEl).on(
                  "click touchstart",
                  function (event) {
                    current_PDFAnnotate.active_canvas = index;
                    current_PDFAnnotate.fabricClickHandler(event, fabricObj);
                  }
                );
                // Esto garantiza que cualquier cambio que se haga en el lienzo se guarde.
                fabricObj.on("after:render", function () {
                  current_PDFAnnotate.fabricObjectsData[index] =
                    fabricObj.toJSON();
                  fabricObj.off("after:render");
                });
              });
            });
          });
        }

        // Manejo del final del procesamiento
        promises
          .then(() => {
            console.log("Todas las páginas han sido procesadas");
            options.ready();
          })
          .catch(function (error) {
            console.error("Error al procesar las páginas:", error);
          });
      },
      //Si hay algún error
      function (reason) {
        console.error(reason);
      }
    );

    //Función para añadir los objetos tipo texto y el borrador
    this.fabricClickHandler = function (event, fabricObj) {
      var current_PDFAnnotate = this;

      // Obtener las coordenadas del evento (clic o toque)
      var x, y;
      if (event.type === "click") {
        x = event.clientX;
        y = event.clientY;
      } else if (event.type === "touchstart") {
        // Obtener la primera posición de toque
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
      }

      if (current_PDFAnnotate.active_tool == 2) {
        var text = new fabric.IText("Escribe acá", {
          left: x - fabricObj.upperCanvasEl.getBoundingClientRect().left,
          top: y - fabricObj.upperCanvasEl.getBoundingClientRect().top,
          fill: current_PDFAnnotate.color,
          fontSize: current_PDFAnnotate.font_size,
          selectable: true,
        });
        fabricObj.add(text);
        current_PDFAnnotate.active_tool = 0;
        var boton = document.getElementById("hand");
        boton.click();
      } else {
        if (current_PDFAnnotate.active_tool == 3) {
          var targetObject = fabricObj.findTarget(event, {
            includeDefaultValues: false,
          });
          if (targetObject) {
            // Eliminar el objeto del lienzo
            fabricObj.remove(targetObject);
          }
        }
      }
    };
  };

  //Función que habilita la herramienta de selección
  PDFAnnotate.prototype.enableSelector = function () {
    var current_PDFAnnotate = this;
    current_PDFAnnotate.active_tool = 0;
    if (current_PDFAnnotate.fabricObjects.length > 0) {
      for (var i = 0; i < current_PDFAnnotate.fabricObjects.length; i++) {
        current_PDFAnnotate.fabricObjects[i].isDrawingMode = false;
        current_PDFAnnotate.fabricObjects[i].selectable = true;
      }
    }
  };

  //Función que habilita la herramienta del lapiz
  PDFAnnotate.prototype.enablePencil = function () {
    var current_PDFAnnotate = this;
    current_PDFAnnotate.active_tool = 1;
    if (current_PDFAnnotate.fabricObjects.length > 0) {
      $.each(current_PDFAnnotate.fabricObjects, function (index, fabricObj) {
        fabricObj.isDrawingMode = true;
      });
    }
  };

  //Función que habilita la herramienta de añadir texto
  PDFAnnotate.prototype.enableAddText = function () {
    var current_PDFAnnotate = this;
    current_PDFAnnotate.active_tool = 2;
    if (current_PDFAnnotate.fabricObjects.length > 0) {
      $.each(current_PDFAnnotate.fabricObjects, function (index, fabricObj) {
        fabricObj.isDrawingMode = false;
      });
    }
  };

  //Función que habilita la opción de eliminar objetos
  PDFAnnotate.prototype.deleteSelectedObject = function () {
    var current_PDFAnnotate = this;
    current_PDFAnnotate.active_tool = 3;
    if (current_PDFAnnotate.fabricObjects.length > 0) {
      $.each(current_PDFAnnotate.fabricObjects, function (index, fabricObj) {
        fabricObj.isDrawingMode = false;
      });
    }
  };

  //Modifica el tamaño del pincel
  PDFAnnotate.prototype.setBrushSize = function (size) {
    var current_PDFAnnotate = this;
    $.each(current_PDFAnnotate.fabricObjects, function (index, fabricObj) {
      fabricObj.freeDrawingBrush.width = size;
    });
  };

  //Modifica el color
  PDFAnnotate.prototype.setColor = function (color) {
    var current_PDFAnnotate = this;
    current_PDFAnnotate.color = color;
    $.each(current_PDFAnnotate.fabricObjects, function (index, fabricObj) {
      fabricObj.freeDrawingBrush.color = current_PDFAnnotate.color;
    });
  };

  //Modifica el tamaño de la fuente
  PDFAnnotate.prototype.setFontSize = function (size) {
    this.font_size = size;
  };

  //Función que permite guardar las páginas del pdf seleccioandas
  PDFAnnotate.prototype.saveSinglePagePdf = function (startPage, endPage) {
    var current_PDFAnnotate = this;

    // Validar que el rango es válido
    if (
      startPage < 1 ||
      endPage > current_PDFAnnotate.fabricObjects.length ||
      startPage > endPage
    ) {
      alert("El rango de páginas ingresado es inválido.");
      return;
    }

    var doc = new jspdf.jsPDF(); // Crear instancia del PDF

    for (var i = startPage - 1; i < endPage; i++) {
      var fabricObj = current_PDFAnnotate.fabricObjects[i];
      // Generar la imagen del lienzo
      var imgData = fabricObj.toDataURL({
        format: "png",
        multiplier: 2, // Mejora la calidad
      });
      // Agregar la imagen al PDF
      doc.addImage(
        imgData,
        "PNG",
        0,
        0,
        doc.internal.pageSize.getWidth(),
        doc.internal.pageSize.getHeight()
      );
      if (i < endPage - 1) {
        doc.addPage(); // Añadir una nueva página al PDF para el siguiente lienzo
      }
    }

    // Guardar el PDF
    var fileName = `pages-${startPage}-${endPage}.pdf`;
    doc.save(fileName);
  };

  //Llamada de la función principal, declaración del objeto pdf
  var pdf = new PDFAnnotate(
    "pdf-container",
    "./assets/Libro de prueba.pdf",
    {
      ready() {
        console.log("Plugin initialized successfully");
        const interval = setInterval(function () {
          let allCanvasesLoaded = true;
          // Verificar si todos los canvas (page-1-canvas, page-2-canvas, ...) existen en el DOM
          for (let i = 1; i <= global_number_of_pages; i++) {
            if ($(`#page-${i}-canvas`).length === 0) {
              allCanvasesLoaded = false; // Si falta uno, aún no han terminado de cargarse
              break;
            }
          }
          if (allCanvasesLoaded) {
            console.log("Todos los canvas están cargados.");
            clearInterval(interval); // Detener la verificación

            // Ocultar el spinner y mostrar el contenedor del PDF
            $("#pdf-container").css("display", "block");
          }
        }, 100); // Verificar cada 100ms
        setTimeout(function () {
          $("#loading-spinner").css("display", "none");
        }, 100);
      },
      //Escala del pdf (Es lo que hay que modificar)
      scale: params(),
    }
  );

  //Acceder a los parámetros del tamaño de la pantalla y del ancho del contenedor padre
  function params() {
    return 0.0010277492291880781 * window.innerWidth + 0.09609455292908531;
  }

  //Función que cambia la herramienta activa
  function changeActiveTool(event) {
    if ($(event.target).hasClass("tool-button")) {
      element = $(event.target);
    } else {
      element = $(event.target).parents(".tool-button").first();
    }
    $(".tool-button.active").removeClass("active");
    $(element).addClass("active");
  }

  //Activar la manito
  function enableSelector(event) {
    event.preventDefault();
    changeActiveTool(event);
    pdf.enableSelector();
  }

  //Activar el pincel normal
  function enablePencil1(event) {
    if (pdf.resaltador_last) {
      pdf.resaltador_last = false;
      pdf.setColor(pdf.anterior);
    }
    pdf.setBrushSize(3);
    event.preventDefault();
    changeActiveTool(event);
    pdf.enablePencil();
  }

  //Activar el pincel subrayado
  function enablePencil2(event) {
    pdf.setBrushSize(10);
    if (pdf.color != "rgba(255, 255, 0, 0.4)") {
      pdf.anterior = pdf.color;
    }
    pdf.resaltador_last = true;
    pdf.setColor("rgba(255, 255, 0, 0.4)");
    event.preventDefault();
    changeActiveTool(event);
    pdf.enablePencil();
  }

  //Activar el texto
  function enableAddText(event) {
    if (pdf.resaltador_last) {
      pdf.resaltador_last = false;
      pdf.setColor(pdf.anterior);
    }
    event.preventDefault();
    changeActiveTool(event);
    pdf.enableAddText();
  }

  //Eliminar objeto seleccionado
  function deleteSelectedObject(event) {
    event.preventDefault();
    pdf.deleteSelectedObject();
  }

  //Guardar PDF
  function savePDF() {
    // Pedir al usuario el rango de páginas (por ejemplo: "1-3")
    var range = prompt(
      "Ingresa el rango de páginas a guardar (ejemplo: 1-3):",
      "1-1"
    );
    if (!range) {
      alert("No se ingresó un rango válido.");
      return;
    }
    // Dividir el rango en inicio y fin
    var parts = range.split("-");
    if (parts.length !== 2) {
      alert("Formato de rango inválido. Usa el formato: inicio-fin (ejemplo: 1-3).");
      return;
    }
    var startPage = parseInt(parts[0], 10);
    var endPage = parseInt(parts[1], 10);
    if (isNaN(startPage) || isNaN(endPage)) {
      alert("El rango ingresado contiene valores no numéricos.");
      return;
    }
    pdf.saveSinglePagePdf(startPage, endPage);
  }

  //Inicializador de las opciones de cambio de tamaño de lápiz, texto y selección de color
  $(function () {
    $(".color-tool").click(function () {
      if (pdf.color[pdf.color.length - 2] != 4) {
        $(".color-tool.active").removeClass("active");
        $(this).addClass("active");
        color = $(this).get(0).style.backgroundColor;
        pdf.setColor(color);
      }
    });

    $("#brush-size").change(function () {
      var width = $(this).val();
      pdf.setBrushSize(width);
    });

    $("#font-size").change(function () {
      var font_size = $(this).val();
      pdf.setFontSize(font_size);
    });
  });
}
